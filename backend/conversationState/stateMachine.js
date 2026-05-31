const {STATES}=require("./stateDefinitions");
const {scoreSignals}=require("./riskScore");
const stateStore=require("./stateStore");

function init(sessionId){
    stateStore.initState(sessionId);
}

function processNLU(sessionId,nluOutput){
    const state=stateStore.getState(sessionId);
    if(!state)return null;

    const {risk,opportunity}=scoreSignals(nluOutput);

    //Decide state transition based on NLU intent
    let nextState=state.currentState;

    const intent =
        typeof nluOutput.intent === "string"
            ? nluOutput.intent
            : nluOutput.intent?.label;

    if(risk>60)nextState=STATES.ESCALATION;
    else if(intent==="objection")nextState=STATES.OBJECTION;
    else if(intent==="purchase")nextState=STATES.DECISION;

    if(nextState!==state.currentState){
        stateStore.updateState(sessionId,{
            currentState:nextState,
            lastStateChangeAt:Date.now(),
        });
    }

    stateStore.updateState(sessionId,{
        riskScore:risk,
        opportunityScore:opportunity,
    });

    return {
        state:nextState,
        risk,
        opportunity,
    };
}

function clear(sessionId){
    stateStore.clearState(sessionId);
}

module.exports={init,processNLU,clear};
