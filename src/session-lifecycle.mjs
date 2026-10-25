// Recovery never interprets transport errors as a signed-out session. Only the
// verified session provider can produce the definitive null/blocked result.
export function createSessionRecovery({session,epoch=()=>0,online=()=>true,checking=()=>{},verified,signedOut,unavailable}){
 let pending;
 return function recover({quiet=false,reload=false}={}){
  if(pending)return pending;
  const generation=epoch();
  if(!quiet)checking();
  const operation=(async()=>{
   try{
    if(!online())throw Error('offline');
    const user=await session();
    if(epoch()!==generation)return;
    if(!user?.active||user.must_change_password){await signedOut(user);return;}
    await verified(user,{reload});
   }catch{
    if(epoch()===generation)unavailable();
   }
  })();
  pending=operation;
  operation.finally(()=>{if(pending===operation)pending=null;});
  return operation;
 };
}
