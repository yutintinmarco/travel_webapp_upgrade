import { db } from "./firebase-service.js";
import {
  doc,
  runTransaction,
  serverTimestamp
} from "./firestore-observed-service.js";
import { assertCloudOnline } from "./cloud-safety-service.js";

const LOCK_TTL_MS=12*60*1000;
function clean(v){return String(v??"").trim();}
function lockId(type){return`${clean(type)||"operation"}_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;}

export async function acquireTripOperation(tripIdInput,typeInput,user){
  assertCloudOnline("旅程更新");
  const tripId=clean(tripIdInput),type=clean(typeInput)||"operation";
  if(!tripId||!user?.uid)throw new Error("Missing trip operation context");
  const ref=doc(db,"trips",tripId);
  const operationId=lockId(type);
  const now=Date.now();

  await runTransaction(db,async tx=>{
    const snap=await tx.get(ref);
    if(!snap.exists()){
      const error=new Error("Trip not found");
      error.code="trip-not-found";
      throw error;
    }
    const data=snap.data()||{};
    const existingId=clean(data.activeOperationId);
    const existingStarted=Number(data.activeOperationStartedAtMs)||0;
    const existingBy=clean(data.activeOperationBy);
    const stale=!existingStarted||now-existingStarted>LOCK_TTL_MS;
    if(existingId&&!stale){
      const error=new Error("Another device is updating this Trip");
      error.code="trip-operation-busy";
      error.operation={
        operationId:existingId,
        type:clean(data.activeOperationType),
        actorUid:existingBy,
        startedAtMs:existingStarted
      };
      throw error;
    }
    tx.update(ref,{
      activeOperationId:operationId,
      activeOperationType:type,
      activeOperationBy:user.uid,
      activeOperationStartedAtMs:now,
      activeOperationStartedAt:serverTimestamp()
    });
  });
  return{tripId,type,operationId};
}

export async function releaseTripOperation(lock,user,{force=false}={}){
  if(!lock?.tripId||!lock?.operationId)return;
  const ref=doc(db,"trips",lock.tripId);
  try{
    await runTransaction(db,async tx=>{
      const snap=await tx.get(ref);
      if(!snap.exists())return;
      const data=snap.data()||{};
      if(!force&&clean(data.activeOperationId)!==clean(lock.operationId))return;
      if(!force&&user?.uid&&clean(data.activeOperationBy)!==clean(user.uid))return;
      tx.update(ref,{
        activeOperationId:"",
        activeOperationType:"",
        activeOperationBy:"",
        activeOperationStartedAtMs:0,
        activeOperationStartedAt:null
      });
    });
  }catch(error){
    console.warn("Unable to release trip operation lock",error);
  }
}
