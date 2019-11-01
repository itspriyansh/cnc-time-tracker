var mongoose=require('mongoose');
var excel=require('excel4node');
var Machine = require('./machineModel');
var Record = require('./recordModel');

module.exports = (mailer, actualStart, actualEnd) => {
    mongoose.connect("mongodb://localhost:27017/machines", {
        useNewUrlParser: false,
        useNewUrlParser: true,
        useUnifiedTopology: true
    }).then(() => {
        return Machine.find();
    }).then((machines) => {
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
        main.cell(2,3).string('18:00:00').style(bold);

        machines.forEach(machine => {
			
			todayRecord.push({
				name: machine.name,
				date: actualStart.toDateString(),
				stopDurations: machine.stopDurations
			});
			
            let sheet=workbook.addWorksheet(machine.name);
            sheet.cell(1,1).string('Name').style(bold);
            sheet.cell(1,2).string(machine.name).style(style);
            sheet.cell(3,1).string('From').style(bold);
            sheet.cell(3,2).string('To').style(bold);
            sheet.cell(3,3).string('Duration').style(bold);
            
			var totalOperation=actualEnd-actualStart;
            for(let i=0;i<machine.stopDurations.length;i++){
                let from=new Date(machine.stopDurations[i].from),to=new Date(machine.stopDurations[i].to);
                let duration=Math.floor((to-from)/1000);
				totalOperation=totalOperation-(to-from);
                let hh=Math.floor(duration/3600),mm=Math.floor((duration%3600)/60),ss=(duration%60);
                if(hh<10) hh='0'+hh;
                if(mm<10) mm='0'+mm;
                if(ss<10) ss='0'+ss;

                sheet.cell(i+4,1).string(from.toTimeString().slice(0,8)).style(style);
                sheet.cell(i+4,2).string(to.toTimeString().slice(0,8)).style(style);
                sheet.cell(i+4,3).string(hh+':'+mm+':'+ss).style(style);
            }

            if(!machine.functioning){
                let from=new Date(machine.stopTime),to=new Date();
                let duration=Math.floor((to-from)/1000);
				totalOperation = totalOperation-(to-from);
                let hh=Math.floor(duration/3600),mm=Math.floor((duration%3600)/60),ss=(duration%60);
                if(hh<10) hh='0'+hh;
                if(mm<10) mm='0'+mm;
                if(ss<10) ss='0'+ss;

                sheet.cell(machine.stopDurations.length+4,1).string(from.toTimeString().slice(0,8)).style(style);
                sheet.cell(machine.stopDurations.length+4,2).string(to.toTimeString().slice(0,8)).style(style);
                sheet.cell(machine.stopDurations.length+4,3).string(hh+':'+mm+':'+ss).style(style);
            }
			
			if(totalOperation<0) totalOperation=0;
			totalOperation=Math.floor(totalOperation/1000);
			let hours=Math.floor(totalOperation/3600), minutes=Math.floor((totalOperation%3600)/60), seconds=(totalOperation%60);
			if(hours<10) hours='0'+hours;
			if(minutes<10) minutes='0'+minutes;
			if(seconds<10) seconds='0'+seconds;
			sheet.cell(2,1).string('Operating Time').style(bold);
			sheet.cell(2,2).string(hours+':'+minutes+':'+seconds).style(style);
        });
		Record.insertMany(todayRecord);
        workbook.writeToBuffer()
		.then((sheet) => {
			mailer.sendMail({
				from: '"Priyansh Bhardwaj" <priyanshbh@gmail.com>',
				to: 'atulmist@gmail.com',
				subject: 'Stop Timings of '+new Date().toDateString(),
				text: 'Please find excel sheet in attachment',
				attachments: [{'filename': 'stopTimings.xlsx', 'content': sheet}]
			},(err,info) => {
				if(err){
					return console.log(err);
				}
			});
		});
        console.log("Stop duration is sent via mail Successfully!");
    },(err) => console.log(err));
}