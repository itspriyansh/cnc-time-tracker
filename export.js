var mongoose=require('mongoose');
var excel=require('excel4node');
var Machine = require('./machineModel');
var Record = require('./recordModel');

module.exports = (mailer, actualStart, actualEnd, Yr, Mn, Dt) => {
    mongoose.connect("mongodb://localhost:27017/machines", {
        useNewUrlParser: false,
        useNewUrlParser: true,
        useUnifiedTopology: true
    }).then(() => {
        return Machine.find();
    }).then((machines) => {
        let startBreak=[11,0,13,0,15,0,17,30,21,30], endBreak=[11,15,13,30,15,15,17,30,21,30];
        let shiftIndex=[
            ['09','00','11','15','13','30','15','15','17','30'],
            ['11','00','13','00','15','00','17','30','21','30']
        ];

        workbook=new excel.Workbook();
        let bold=workbook.createStyle({
            font:{bold:true,size:10}
        }),style=workbook.createStyle({
            font:{size:10}
        });
		let todayRecord=[];

        let main=workbook.addWorksheet('Main');
        main.cell(1,1).string('Date').style(bold);
        main.cell(1,2).string(new Date().toDateString()).style(style);
        main.cell(2,1).string('Shift Timing').style(bold);
        main.cell(2,2).string('09:00:00').style(bold);
        main.cell(2,3).string('17:30:00').style(bold);

        machines.forEach(machine => {

            if(!machine.functioning){
                let from=new Date(machine.stopTime),to=actualEnd;
                machine.stopDurations.push({
                    from: from.toISOString(),
                    to: to.toISOString()
                });
            }

            let sheet=workbook.addWorksheet(machine.name), curBreakIndex=0;
            sheet.cell(1,1).string('Name').style(bold);
            sheet.cell(1,2).string(machine.name).style(style);
            
            let written=[false,false,false,false,false];

            var totalOperation=actualEnd-actualStart-3600000,totalStoppage=0,padding=4;
            for(let i=0;i<machine.stopDurations.length;i++){
                let from=new Date(machine.stopDurations[i].from),to=new Date(machine.stopDurations[i].to);
                let startBreakT=new Date(Yr,Mn,Dt,startBreak[curBreakIndex],startBreak[curBreakIndex+1],0,0);
                let endBreakT=new Date(Yr,Mn,Dt,endBreak[curBreakIndex],endBreak[curBreakIndex+1],0,0);
                let printAfterInt=false;

                if(to.getTime()>startBreakT.getTime()){
                    
                    if(from.getTime()<startBreakT.getTime() && to.getTime()>endBreakT.getTime()){
                        if(curBreakIndex<7){
                            machine.stopDurations.splice(i+1,0,{
                                from: endBreakT.toISOString(),
                                to: machine.stopDurations[i].to
                            });
                        }
                        machine.stopDurations[i].to=startBreakT.toISOString();
                        to=startBreakT;
                    }else if(from.getTime()<startBreakT.getTime()){
                        machine.stopDurations[i].to=startBreakT.toISOString();
                        to=startBreakT;
                    }else if(to.getTime()>endBreakT.getTime() && from.getTime()<=endBreakT.getTime()){
                        if(curBreakIndex<7){
                            machine.stopDurations[i].from=endBreakT.toISOString();
                            from=endBreakT;
                        }else{
                            machine.stopDurations.splice(i,1);
                            i--;
                        }
                        continue;
                    }else if(from.getTime()>=startBreakT.getTime() && to.getTime()<=endBreakT.getTime()){
                        machine.stopDurations.splice(i,1);
                        i--;
                        continue;
                    }else{
                        curBreakIndex+=2;
                        i--;
                        continue;
                    }
                }

                let indexForCheck=Math.floor(curBreakIndex/2);
                if(!written[indexForCheck]){
                    for(let j=0;j<indexForCheck;j++){
                        if(!written[j]){
                            written[j]=true;
                            sheet.cell(i+padding,1).string(shiftIndex[0][2*j]+':'+shiftIndex[0][2*j+1]+' to '+shiftIndex[1][2*j]+':'+shiftIndex[1][2*j+1]).style(bold);
                            sheet.cell(i+padding+1,1).string('--Empty--').style(style);
                            padding+=2;
                        }
                    }
                    written[indexForCheck]=true;
                    sheet.cell(i+padding,1).string(shiftIndex[0][2*indexForCheck]+':'+shiftIndex[0][2*indexForCheck+1]+' to '+shiftIndex[1][2*indexForCheck]+':'+shiftIndex[1][2*indexForCheck+1]).style(bold);
                    sheet.cell(i+padding+1,1).string('From').style(bold);
                    sheet.cell(i+padding+1,2).string('To').style(bold);
                    sheet.cell(i+padding+1,3).string('Duration').style(bold);
                    padding+=2;
                }

                let duration=Math.floor((to-from)/1000);
		        totalStoppage+=(to-from);
                let hh=Math.floor(duration/3600),mm=Math.floor((duration%3600)/60),ss=(duration%60);
                if(hh<10) hh='0'+hh;
                if(mm<10) mm='0'+mm;
                if(ss<10) ss='0'+ss;

                sheet.cell(i+padding,1).string(from.toTimeString().slice(0,8)).style(style);
                sheet.cell(i+padding,2).string(to.toTimeString().slice(0,8)).style(style);
                sheet.cell(i+padding,3).string(hh+':'+mm+':'+ss).style(style);
            }

            if(padding==4){
                sheet.cell(machine.stopDurations.length+padding).string('09:00 to 11:00').style(bold);
                sheet.cell(machine.stopDurations.length+padding+1).string('--Empty--').style(style);
                padding+=2;
            }
            if(padding==6){
                sheet.cell(machine.stopDurations.length+padding).string('11:15 to 13:00').style(bold);
                sheet.cell(machine.stopDurations.length+padding+1).string('--Empty--').style(style);
                padding+=2;
            }if(padding==8){
                sheet.cell(machine.stopDurations.length+padding).string('13:30 to 15:00').style(bold);
                sheet.cell(machine.stopDurations.length+padding+1).string('--Empty--').style(style);
                padding+=2;
            }if(padding==10){
                sheet.cell(machine.stopDurations.length+padding).string('15:15 to 17:30').style(bold);
                sheet.cell(machine.stopDurations.length+padding+1).string('--Empty--').style(style);
                padding+=2;
            }if(padding==12){
                sheet.cell(machine.stopDurations.length+padding).string('17:30 to 21:30').style(bold);
                sheet.cell(machine.stopDurations.length+padding+1).string('--Empty--').style(style);
                padding+=2;
            }

            todayRecord.push({
                name: machine.name,
                date: actualStart.toDateString(),
                stopDurations: machine.stopDurations
            });

            totalOperation-=totalStoppage;
    		if(totalOperation<0) totalOperation=0;
    		totalOperation=Math.floor(totalOperation/1000);
    		let hours=Math.floor(totalOperation/3600), minutes=Math.floor((totalOperation%3600)/60), seconds=(totalOperation%60);
    		if(hours<10) hours='0'+hours;
    		if(minutes<10) minutes='0'+minutes;
    		if(seconds<10) seconds='0'+seconds;
    		sheet.cell(2,1).string('Operating Time').style(bold);
    		sheet.cell(2,2).string(hours+':'+minutes+':'+seconds).style(style);

            totalStoppage=Math.floor(totalStoppage/1000);
			hours=Math.floor(totalStoppage/3600);
            minutes=Math.floor((totalStoppage%3600)/60);
            seconds=(totalStoppage%60);
			if(hours<10) hours='0'+hours;
			if(minutes<10) minutes='0'+minutes;
			if(seconds<10) seconds='0'+seconds;
			sheet.cell(3,1).string('Stoppage Time').style(bold);
			sheet.cell(3,2).string(hours+':'+minutes+':'+seconds).style(style);
        });
		Record.insertMany(todayRecord);
        workbook.writeToBuffer()
		.then((sheet) => {
			mailer.sendMail({
				from: '"Priyansh Bhardwaj" <priyanshbh@gmail.com>',
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
        console.log("Stop duration is sent via mail Successfully!");
    },(err) => console.log(err));
}
