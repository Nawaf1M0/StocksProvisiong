function calculate(s, fractional=false) {
  const {shares:q, average:a, price:p, target:t, fee:f=0, budget:b=0}=s;
  if (![q,a,p,t,f,b].every(Number.isFinite)||q<=0||a<=0||p<=0||t<=0||f<0||b<0) return {error:'Enter positive shares and prices, and non-negative fees and budget.'};
  const budgetShares=fractional?Math.max(0,(b-f)/p):Math.floor(Math.max(0,(b-f)/p));
  const budgetCost=budgetShares>0?budgetShares*p+f:0;
  const preview=(q*a+budgetCost)/(q+budgetShares);
  if(t>=a) return {error:'Your average is already at or below this target.',budgetShares,budgetCost,preview};
  if(p>=t) return {error:'Buy price must be below the target average. This target cannot be reached at this price.',budgetShares,budgetCost,preview};
  const exact=(q*(a-t)+f)/(t-p);
  const buy=fractional?exact:Math.ceil(exact-1e-10);
  const cash=buy*p+f;
  const result=(q*a+cash)/(q+buy);
  return {buy,cash,result,recoveryBefore:(a/p-1)*100,recoveryAfter:(result/p-1)*100,budgetShares,budgetCost,preview};
}
if(typeof module!=='undefined') module.exports={calculate};
