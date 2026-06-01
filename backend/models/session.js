const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    sessionId:{
        type:String,
        required:true,
        unique:true
    },
    startTime:{
        type:Date,
        default:Date.now
    },
    endTime:{
        type:Date
    },
    status:{
        type:String,
        enum:['active','inactive'],
        default:'active',
        summary:{
            discussed:[String],
            actionItems:[String],
            decisions:[String], 
            crm_fields:{
                type:Object,default:{}
            }
        }
    }

})