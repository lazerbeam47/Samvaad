function scoreSignals(nluOutput){
    let risk=0;
    let opportunity=0;

    //Risk Signals
    const intent =
        typeof nluOutput.intent === "string"
            ? nluOutput.intent
            : nluOutput.intent?.label;
    const sentiment = nluOutput.sentiment || nluOutput.crm?.sentiment;

    if(intent==="complaint")risk+=30;
    if(nluOutput.compliance?.length)risk+=20;
    if(sentiment==="negative")risk+=25;

    //Opportunity Signals
    if(intent==="upsell")opportunity+=40;
    if(intent==="upgrade")opportunity+=30;
    if(sentiment==="positive")opportunity+=20;

    return {
        risk:Math.min(risk,100),
        opportunity:Math.min(opportunity,100),
    };
}

module.exports={
    scoreSignals
};
