function calculate(s, fractional=false) {
  const {shares:q, average:a, price:p, target:t, fee:f=0, budget:b=0}=s;
  if (![q,a,p,t,f,b].every(Number.isFinite)||q<=0||a<=0||p<=0||t<=0||f<0||b<0) return {error:'Enter positive shares and prices, and non-negative fees and budget.'};
  const affordable=Math.max(0,(b-f)/p);
  // Decimal prices can divide to just below an integer (0.3 / 0.1).
  const nearest=Math.round(affordable);
  const whole=Math.abs(affordable-nearest)<=4*Number.EPSILON*Math.max(1,affordable)?nearest:Math.floor(affordable);
  const budgetShares=fractional?affordable:whole;
  // Clamp only the floating-point residue at the available cash boundary.
  const budgetCost=budgetShares>0?Math.min(b,budgetShares*p+f):0;
  const preview=(q*a+budgetCost)/(q+budgetShares);
  if(t>=a) return {error:'Your average is already at or below this target.',budgetShares,budgetCost,preview};
  if(p>=t) return {error:'Buy price must be below the target average. This target cannot be reached at this price.',budgetShares,budgetCost,preview};
  const exact=(q*(a-t)+f)/(t-p);
  const buy=fractional?exact:Math.ceil(exact-1e-10);
  const cash=buy*p+f;
  const result=(q*a+cash)/(q+buy);
  return {buy,cash,result,recoveryBefore:(a/p-1)*100,recoveryAfter:(result/p-1)*100,budgetShares,budgetCost,preview};
}
function positionRisk(s, buy, cash, otherValue) {
  if (![s.shares,s.average,s.price,buy,cash,otherValue].every(Number.isFinite)||s.shares<=0||s.average<=0||s.price<=0||buy<0||cash<0||otherValue<0) return null;
  const valueBefore=s.shares*s.price, valueAfter=(s.shares+buy)*s.price;
  const costBefore=s.shares*s.average, costAfter=costBefore+cash;
  return {valueBefore,valueAfter,costBefore,costAfter,
    weightBefore:valueBefore/(otherValue+valueBefore)*100,
    weightAfter:valueAfter/(otherValue+valueAfter)*100,
    pnlBefore:valueBefore-costBefore,pnlAfter:valueAfter-costAfter};
}
if(typeof module!=='undefined') module.exports={calculate,positionRisk};

