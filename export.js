var mongoose=require('mongoose');
// Module to write excel sheet
var excel=require('excel4node');
// Model for collection to track current shift status
var Machine = require('./machineModel');
// Model that stores stopdurations of all days
var Record = require('./recordModel');

// Fuction to print break at the end of shift
var printBreak = (index) => {
    if(index===1) return 'Breakfast';
    else if(index===2) return 'Lunch';
    else if(index===3) return 'Evening Tea';
    else if(index===4) return 'End Of Day';
};

// Function that converts a duration in seconds into a time string in hh:mm:ss format
var timeString = (duration) => {
    if(duration<0) duration=0;
    let hh=Math.floor(duration/3600),mm=Math.floor((duration%3600)/60),ss=(duration%60);

    if(hh<10) hh='0'+hh;
    if(mm<10) mm='0'+mm;
    if(ss<10) ss='0'+ss;

    let str=hh+':'+mm+':'+ss;
    return str;
}

// Main function to process data into excel sheet and send the sheet
module.exports = (mailer, actualStart, actualEnd, Yr, Mn, Dt) => {
    // Establish connection to mongodb database
    mongoose.connect("mongodb://localhost:27017/machines", {
        useNewUrlParser: false,
        useNewUrlParser: true,
        useUnifiedTopology: true
    }).then(() => {
        // extract data of current day's shift
        return Machine.find();
    }).then((machines) => {
        // 'startBreak' is array of start time of all breaks
        // 'endBreak' is array of end time of all breaks
        // both arrays stores hour valus on even index and minute value on odd index sequentially
        let startBreak=[11,0,13,0,15,0,17,30,21,30], endBreak=[11,15,13,30,15,15,17,30,21,30];

        // array of subshifts of shift in format as described above
        // first index array stores start-time and second index array stores end-time
        let shiftIndex=[
            ['09','00','11','15','13','30','15','15','17','30'],
            ['11','00','13','00','15','00','17','30','21','30']
        ];

        // Initializing an excel file
        workbook=new excel.Workbook();

        // 'bold' is format with bold fond and 'style' is normal format font
        let bold=workbook.createStyle({
            font:{bold:true,size:10}
        }),style=workbook.createStyle({
            font:{size:10}
        });

        // 'todayRecord' will save stopDurations of all machines
		let todayRecord=[];

        // introduction sheet of the excel file
        let main=workbook.addWorksheet('Main');
        main.cell(1,1).string('Date').style(bold);
        main.cell(1,2).string(new Date().toDateString()).style(style);
        main.cell(2,1).string('Shift Timing').style(bold);
        main.cell(2,2).string('09:00:00').style(bold);
        main.cell(2,3).string('17:30:00').style(bold);

        // Looping over all the machines
        machines.forEach(machine => {

            // if the machine was OFF at the end of the sheet, add another stop-duration
            if(!machine.functioning){
                let from=new Date(machine.stopTime),to=actualEnd;
                machine.stopDurations.push({
                    from: from.toISOString(),
                    to: to.toISOString()
                });
            }

            // Add a sheet corresponding the machine
            let sheet=workbook.addWorksheet(machine.name), curBreakIndex=0;

            // name of the machine
            sheet.cell(1,1).string('Name').style(bold);
            sheet.cell(1,2).string(machine.name).style(style);

            // tracking whether the subshifts are written on sheet
            // values are initially false
            // 0 index represents sub-shift from morning to breakfast and so on
            let written=[false,false,false,false,false];

            /* 'totalOpertaion' represents total processing of the machine
                excluding break time(3600 secs) and overtime(14400 sec) */
            // 'totalStoppage' will count total stop time of the machine
            // 'padding' is used to align content on excel sheet
            var totalOperation=actualEnd-actualStart-3600000-14400000,totalStoppage=0,padding=6;
            var overTime=14400000; // total over-time

            // Looping over all stop durations
            for(let i=0;i<machine.stopDurations.length;i++){
                // initializing 'from' and 'to' time of the duration
                let from=new Date(machine.stopDurations[i].from),to=new Date(machine.stopDurations[i].to);

                // 'startBreakT' is start time of upcoming break
                let startBreakT=new Date(Yr,Mn,Dt,startBreak[curBreakIndex],startBreak[curBreakIndex+1],0,0);
                // 'endBreakT' is end time of upcoming break
                let endBreakT=new Date(Yr,Mn,Dt,endBreak[curBreakIndex],endBreak[curBreakIndex+1],0,0);

                // if the duration is exceeding the start of upcoming break
                if(to.getTime()>startBreakT.getTime()){
                    
                    // if the duration is also exceeding end time of upcoming break
                    if(from.getTime()<startBreakT.getTime() && to.getTime()>endBreakT.getTime()){

                        // if the shift is working shift, add a duration corresponding to after break ends
                        // Just split the duration excluding the break interval
                        if(curBreakIndex<7){
                            machine.stopDurations.splice(i+1,0,{
                                from: endBreakT.toISOString(),
                                to: machine.stopDurations[i].to
                            });
                        }
                        machine.stopDurations[i].to=startBreakT.toISOString();
                        to=startBreakT;
                    }
                    // if the duration has its end piece in break interval
                    else if(from.getTime()<startBreakT.getTime()){
                        machine.stopDurations[i].to=startBreakT.toISOString();
                        to=startBreakT;
                    }
                    // if the duration has its beginning piece in break interval
                    else if(to.getTime()>endBreakT.getTime() && from.getTime()<=endBreakT.getTime()){
                        // Check if the current shift is working shift
                        if(curBreakIndex<7){
                            machine.stopDurations[i].from=endBreakT.toISOString();
                            from=endBreakT;
                        }else{
                            machine.stopDurations.splice(i,1);
                        }
                        curBreakIndex+=2;
                        i--;
                        continue;
                    }
                    // Simply delete the duration it fully lies in break interval
                    else if(from.getTime()>=startBreakT.getTime() && to.getTime()<=endBreakT.getTime()){
                        machine.stopDurations.splice(i,1);
                        i--;
                        continue;
                    }
                    // If none condition matches, consider next upcoming break
                    // and check for the duration once again
                    else{
                        curBreakIndex+=2;
                        i--;
                        continue;
                    }
                }

                // Conversion for simplicity of upcoming calculations
                let indexForCheck=Math.floor(curBreakIndex/2);

                // if title of current shift is not yet written
                if(!written[indexForCheck]){
                    // 'flagBeforeStop' is true if stop duration is present in previous sub-shift
                    // 'prevSlotState' represents emptiness of stop duration list of previous subshift
                    let flagOfBeforeStop=true, prevSlotState=false;

                    // Checking if titles of previous subshift is written or not
                    for(let j=0;j<indexForCheck;j++){
                        if(!written[j]){
                            flagOfBeforeStop=false;

                            // Write computed timings of before and after stop durations in the break
                            if(prevSlotState){
                                sheet.cell(i+padding+1,1).string(printBreak(j)).style(bold);
                                let beforeStop=new Date(Yr,Mn,Dt,startBreak[2*j],startBreak[2*j+1],0,0)-new Date(machine.stopDurations[i-1].from);
                                beforeStop=Math.floor(beforeStop/1000);

                                sheet.cell(i+padding+2,1).string('Before').style(bold);
                                sheet.cell(i+padding+2,2).string(timeString(beforeStop)).style(style);

                                sheet.cell(i+padding+2,3).string('After').style(bold);
                                sheet.cell(i+padding+2,4).string('nil').style(style);

                                padding+=3;
                            }

                            // Now write the title of subshift with empty record
                            prevSlotState=false;
                            written[j]=true;
                            sheet.cell(i+padding+1,1).string(shiftIndex[0][2*j]+':'+shiftIndex[0][2*j+1]+' to '+shiftIndex[1][2*j]+':'+shiftIndex[1][2*j+1]).style(bold);
                            sheet.cell(i+padding+2,1).string('--Empty--').style(style);
                            padding+=3;
                        }else prevSlotState=true;
                    }
                    written[indexForCheck]=true;

                    // Start writing values corresponding to breaks that occured previously
                    if(indexForCheck>0){
                        sheet.cell(i+padding+1,1).string(printBreak(indexForCheck)).style(bold);

                        let beforeStop='nil';
                        if(flagOfBeforeStop){
                            beforeStop=new Date(Yr,Mn,Dt,startBreak[curBreakIndex-2],startBreak[curBreakIndex-1],0,0)-new Date(machine.stopDurations[i-1].from);
                            beforeStop=Math.floor(beforeStop/1000);
                            beforeStop=timeString(beforeStop);
                        }
                        let afterStop=new Date(machine.stopDurations[i].from)-new Date(Yr,Mn,Dt,endBreak[curBreakIndex-2],endBreak[curBreakIndex-1],0,0);
                        afterStop=timeString(Math.floor(afterStop/1000));

                        sheet.cell(i+padding+2,1).string('Before').style(bold);
                        sheet.cell(i+padding+2,2).string(beforeStop).style(style);

                        sheet.cell(i+padding+2,3).string('After').style(bold);
                        sheet.cell(i+padding+2,4).string(afterStop).style(style);

                        padding+=3;
                    }

                    // Write the title for current subshift
                    sheet.cell(i+padding+1,1).string(shiftIndex[0][2*indexForCheck]+':'+shiftIndex[0][2*indexForCheck+1]+' to '+shiftIndex[1][2*indexForCheck]+':'+shiftIndex[1][2*indexForCheck+1]).style(bold);
                    sheet.cell(i+padding+2,1).string('From').style(bold);
                    sheet.cell(i+padding+2,2).string('To').style(bold);
                    sheet.cell(i+padding+2,3).string('Duration').style(bold);
                    padding+=3;
                }

                // Convert the duration in suitable format and wite in sheet
                let duration=Math.floor((to-from)/1000);
                if(indexForCheck<4) totalStoppage+=(to-from);
                else overTime-=(to-from);

                // write in bold if the duration is in working shift and greater than 10 mins
                let bigStop=(indexForCheck<4 && duration>=600);

                // Start Writing
                sheet.cell(i+padding,1).string(from.toTimeString().slice(0,8)).style(bigStop?bold:style);
                sheet.cell(i+padding,2).string(to.toTimeString().slice(0,8)).style(bigStop?bold:style);
                sheet.cell(i+padding,3).string(timeString(duration)).style(bigStop?bold:style);
            }

            // 'inddx' is actually number of all durations
            let prevSlotState=false, inddx=machine.stopDurations.length;

            // Loop and check if writing title of any shift is not missed
            // write the title with empty tag if missed
            for(let j=0;j<=4;j++){
                if(!written[j]){

                    // Write the info of break if informative
                    if(prevSlotState){
                        sheet.cell(inddx+padding+1,1).string(printBreak(j)).style(bold);
                        let beforeStop=new Date(Yr,Mn,Dt,startBreak[2*j],startBreak[2*j+1],0,0)-new Date(machine.stopDurations[inddx-1].from);
                        beforeStop=Math.floor(beforeStop/1000);

                        sheet.cell(inddx+padding+2,1).string('Before').style(bold);
                        sheet.cell(inddx+padding+2,2).string(timeString(beforeStop)).style(style);

                        sheet.cell(inddx+padding+2,3).string('After').style(bold);
                        sheet.cell(inddx+padding+2,4).string('nil').style(style);

                        padding+=3;
                    }

                    prevSlotState=false;

                    written[j]=true;
                    sheet.cell(inddx+padding+1,1).string(shiftIndex[0][2*j]+':'+shiftIndex[0][2*j+1]+' to '+shiftIndex[1][2*j]+':'+shiftIndex[1][2*j+1]).style(bold);
                    sheet.cell(inddx+padding+2,1).string('--Empty--').style(style);
                    padding+=3;
                }else prevSlotState=true;
            }

            // push stop durations of the machine into 'todayRecord' array
            todayRecord.push({
                name: machine.name,
                date: actualStart.toDateString(),
                stopDurations: machine.stopDurations
            });

            // Exceed stop durations from operting durations
            totalOperation-=totalStoppage;
    		if(totalOperation<0) totalOperation=0;

            // Conversion from mili-seconds to seconds//
    		totalOperation=Math.floor(totalOperation/1000);
            // record operating time to the sheet
    		sheet.cell(2,1).string('Operating Time').style(bold);
    		sheet.cell(2,2).string(timeString(totalOperation)).style(style);

            // Conversion from mili-seconds to seconds//
            totalStoppage=Math.floor(totalStoppage/1000);
            // record operating time to the sheet
			sheet.cell(3,1).string('Stoppage Time').style(bold);
			sheet.cell(3,2).string(timeString(totalStoppage)).style(style);

            // Conversion from mili-seconds to seconds//
            overTime=Math.floor(overTime/1000);
            // record operating time to the sheet
            sheet.cell(4,1).string('Over Time').style(bold);
            sheet.cell(4,2).string(timeString(overTime)).style(style);
        });

        // Push current day's stop duration record into collection behaving as warehouse
		Record.insertMany(todayRecord);

        // Send the excel file to target mail id and return
        workbook.writeToBuffer()
		.then((sheet) => {
			mailer.sendMail({
				from: '"CNC Time Tracker" <sfwreport@gmail.com>',
				to: 'atulmist@gmail.com',
				subject: 'Stop Timings of '+new Date().toDateString(),
				text: 'Please find excel sheet in attachment',
				attachments: [{'filename': 'StopTimings '+new Date().toDateString()+'.xlsx', 'content': sheet}]
			},(err,info) => {
				if(err){
					return console.log(err);
				}
			});
		});
        // Notify that the excel file is successfully sent
        console.log("Stop duration is sent via mail Successfully!");
    },(err) => console.log(err));
}
