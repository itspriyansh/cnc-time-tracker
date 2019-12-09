var mqtt = require('mqtt');
var mongoose = require('mongoose');
var Machine = require('./machineModel');
var exportData = require('./export');   // To process collected data to excel fil and send via mail
var mailer = require('nodemailer');

// Set Up Mailer to send mail to other Mail ids
var transporter = mailer.createTransport({
	service: 'gmail', // Host Mail Service
	auth: {
		user: 'priyanshbh@gmail.com', // Host mail id
		pass: '9828490944@leavemealone' // Password of host mail id
	},
	tls: { rejectUnauthorized: false }
});

// Address hosting socket that sends machine data every 2 seconds
var client = mqtt.connect('mqtt://103.205.66.73:4200');

// 'machine' is array that stores data of all machines
// 'names' is a dictionary storing index for each name of machine
// 'connected' is true during working shift including overtime and false otherwise
// 'stopped' is true when processing of incoming data is in progress
var machines=[], names={},connected=false,stopped=false;

// Connection to socket
client.on('connect',()=>{
    client.subscribe('CNC');
});

// Connection to mongodb database
mongoose.connect("mongodb://localhost:27017/machines", {
    useNewUrlParser: false,
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    // Notifies of successfull connection to database
    console.log("Successfully connected to server!");
	
    // On receiving machine status data
    client.on('message',(topic,body) => {
        // 'data' is data in JSON format
        // 'toInsert' tracks all new machines to be inserted in collection that tracks current day's stop times
        let data=JSON.parse(body), toInsert=[];

        // 'today' is current time
        // 'start' is start of shift and 'endD' is end of shift
        let today=new Date(data.timestamp), Dt=today.getDate(), Mn=today.getMonth(), Yr=today.getFullYear();
        let start=new Date(Yr,Mn,Dt,9,0,0,0), endD=new Date(Yr,Mn,Dt,21,30,0,0);

        // if current day's shift traching is not yed started and no processing is going on
        if(!stopped && !connected){
            // if current data's timestamp is within working shift
            if(today.getTime()>=start.getTime() && today.getTime()<=endD.getTime()){
				stopped=true; // Means processing has started

                // Notifies that tracking of stop durations has started
                console.log("Stop durations are being tracked...");

                // Updating all machine status assuming they are initially ON
                Machine.updateMany({},{
                    functioning: true,
                    startTime: new Date(),
                    stopDurations: []
                },{new: true}).then(() => {
                    return Machine.find();
                }).then(initial => {
                    // Emptying local variable too
                    machines=[];
                    names={};

                    // Start of new Day
                    console.log("Server is running...");

                    // Looping over all machines
                    initial.forEach(mac => {
                        // Pushing back machine to 'machines' array
                        names[mac.name]=machines.length;
                        machines.push({
                            name: mac.name,
                            startTime: mac.startTime,
                            stopTime: mac.stopTime,
                            functioning: mac.functioning,
                            stopDurations: mac.stopDurations
                        });
                    });
                    // Today's connection has been eshtablished and processing is done
					connected=true;
					stopped=false;
                },(err) => console.log(err));
            }
        }

        // if tracking the shift has started and no processing is going on
        else if(!stopped){
            // Looping over all machines in data
            for(let key in data){
                // as 'timestamp' and 'watch_dog' does not correspond to machines
                if(key==='timestamp' || key==='watch_dog') continue;

                // if machine name is new and not yet added to 'machine' array
                if(names[key]===undefined){
                    // preparing object for the new machine
                    let obj={
                        name: key,
                        functioning: data[key]
                    };
                    // Update start-time if machine is ON and stop-time otherwise
                    let date=(data[key]?'startTime':'stopTime');
                    obj[date]=data.timestamp;

                    // Push to list that tracks new machines to be inserted in databse
                    toInsert.push(obj);
                }
                // if machine is already present in tracking collection
                else{
                    // if status of machine has chenged, just update its start or stop time
                    if(machines[names[key]].functioning!==data[key]){
                        machines[names[key]].functioning=data[key];

                        // Deciding which field to update according to data
                        let date=(data[key]?'startTime':'stopTime');

                        // if machine has been turned ON, update the list of stop-durations
                        if(data[key]){
                            machines[names[key]].stopDurations.push({
                                from: machines[names[key]].stopTime,
                                to: data.timestamp
                            });
                        }
                        // 'date' -> either start-time or stop-time
                        machines[names[key]][date]=data.timestamp;

                        // Update the machine in database asynchronously
                        Machine.findOneAndUpdate({name: key}, machines[names[key]], {useFindAndModify: false,new: true}, (err,mac) => {
                            if(err){
                                console.log(err);
                                return;
                            }
                            // Update local variable 'machines'
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

            // if list of new machines is not empty
            if(toInsert.length!==0){
                // insert all the new machines into database
                Machine.insertMany(toInsert, (err,mac) => {
                    if(err){
                        console.log(err);
                        return;
                    }
                    mac.forEach(machine => {
                        // Now add each new machine to local variable 'machines'
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
                    // Empty the list of new machines
                    toInsert=[];
                });
            };

            // if the shift has came to an end
            if(today.getTime()>=endD.getTime()){
                // Start processing of data into excel sheet and send it via mail
                exportData(transporter, start, today,Yr,Mn,Dt);
                connected=false; // End of the Day
                // Notifies that tracking is inactive now
                console.log("Tracking is stopped for today!");
            }
        }
    });
},(err)=>console.log(err));