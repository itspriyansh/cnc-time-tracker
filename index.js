var mqtt = require('mqtt');
var mongoose = require('mongoose');
var Machine = require('./machineModel');
var exportData = require('./export');
var mailer = require('nodemailer');
var fs = require('fs');
var xoauth2 = require('xoauth2');

var transporter = mailer.createTransport({
	service: 'gmail',
	auth: {
		user: 'priyanshbh@gmail.com',
		pass: '9828490944@leavemealone'
	},
	tls: { rejectUnauthorized: false }
});

var client = mqtt.connect('mqtt://103.205.66.73:4200');
var machines=[], names={},connected=false;

client.on('connect',()=>{
    client.subscribe('CNC');
});

mongoose.connect("mongodb://localhost:27017/machines", {
    useNewUrlParser: false,
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log("Successfully connected to server!");

    client.on('message',(topic,body) => {
        let data=JSON.parse(body), toInsert=[];
        let today=new Date(data.timestamp), Dt=today.getDate(), Mn=today.getMonth(), Yr=today.getFullYear();
        let start=new Date(Yr,Mn,Dt,9,0,0,0), endD=new Date(Yr,Mn,Dt,18,0,0,0);
        if(!connected){
            if(today.getTime()>=start.getTime() && today.getTime()<=endD.getTime()){
                console.log("Stop durations are being tracked...");
                Machine.updateMany({},{
                    functioning: true,
                    startTime: new Date(),
                    stopDurations: []
                },{new: true}).then(() => {
                    return Machine.find();
                }).then(initial => {
                    machines=[];
                    names={};
                    console.log("Server is running...");
                    initial.forEach(mac => {
                        names[mac.name]=machines.length;
                        machines.push({
                            name: mac.name,
                            startTime: mac.startTime,
                            stopTime: mac.stopTime,
                            functioning: mac.functioning,
                            stopDurations: mac.stopDurations
                        });
                    });
                    connected=true;
                },(err) => console.log(err));
            }
        }
        if(connected){
            for(let key in data){
                if(key==='timestamp') continue;
                if(names[key]===undefined){
                    let obj={
                        name: key,
                        functioning: data[key]
                    };
                    let date=(data[key]?'startTime':'stopTime');
                    obj[date]=data.timestamp;
                    toInsert.push(obj);
                }else{
                    if(machines[names[key]].functioning!==data[key]){
                        machines[names[key]].functioning=data[key];
                        let date=(data[key]?'startTime':'stopTime');
                        if(data[key]){
                            machines[names[key]].stopDurations.push({
                                from: machines[names[key]].stopTime,
                                to: data.timestamp
                            });
                        }
                        machines[names[key]][date]=data.timestamp;
                        Machine.findOneAndUpdate({name: key}, machines[names[key]], {useFindAndModify: false,new: true}, (err,mac) => {
                            if(err){
                                console.log(err);
                                return;
                            }
                            machines[names[key]]={
                                name: mac.name,
                                startTime: mac.startTime,
                                stopTime: mac.stopTime,
                                functioning: mac.functioning,
                                stopDurations: mac.stopDurations
                            };
                        });
                    }
                }
            }
            if(toInsert.length!==0){
                Machine.insertMany(toInsert, (err,mac) => {
                    if(err){
                        console.log(err);
                        return;
                    }
                    mac.forEach(machine => {
                        if(names[machine.name]===undefined){
                            names[machine.name]=machines.length;
                            machines.push({
                                name: machine.name,
                                startTime: machine.startTime,
                                stopTime: machine.stopTime,
                                functioning: machine.functioning,
                                stopDurations: machine.stopDurations
                            });
                        }
                    });
                    toInsert=[];
                });
            };
            if(new Date(data.timestamp).getTime()>=endD.getTime()){
                exportData(transporter);
                connected=false;
                console.log("Tracking is stopped for today!");
            }
        }
    });
},(err)=>console.log(err));