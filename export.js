var mongoose=require('mongoose');
var excel=require('excel4node');
var Machine = require('./machineModel');

module.exports = (mailer) => {
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

        let main=workbook.addWorksheet('Main');
        main.cell(1,1).string('Date').style(bold);
        main.cell(1,2).string(new Date().toDateString()).style(style);
        main.cell(2,1).string('Shift Timing').style(bold);
        main.cell(2,2).string('09:00:00').style(bold);
        main.cell(2,3).string('18:00:00').style(bold);

        machines.forEach(machine => {
            let sheet=workbook.addWorksheet(machine.name);
            sheet.cell(1,1).string('Name').style(bold);
            sheet.cell(1,2).string(machine.name).style(style);
            sheet.cell(2,1).string('From').style(bold);
            sheet.cell(2,2).string('To').style(bold);
            sheet.cell(2,3).string('Duration').style(bold);
            
            for(let i=0;i<machine.stopDurations.length;i++){
                let from=new Date(machine.stopDurations[i].from),to=new Date(machine.stopDurations[i].to);
                let duration=Math.floor((to-from)/1000);
                let hh=Math.floor(duration/3600),mm=Math.floor((duration%3600)/60),ss=(duration%60);
                if(hh<10) hh='0'+hh;
                if(mm<10) mm='0'+mm;
                if(ss<10) ss='0'+ss;

                sheet.cell(i+3,1).string(from.toTimeString().slice(0,8)).style(style);
                sheet.cell(i+3,2).string(to.toTimeString().slice(0,8)).style(style);
                sheet.cell(i+3,3).string(hh+':'+mm+':'+ss).style(style);
            }

            if(!machine.functioning){
                let from=new Date(machine.stopTime),to=new Date();
                let duration=Math.floor((to-from)/1000);
                let hh=Math.floor(duration/3600),mm=Math.floor((duration%3600)/60),ss=(duration%60);
                if(hh<10) hh='0'+hh;
                if(mm<10) mm='0'+mm;
                if(ss<10) ss='0'+ss;

                sheet.cell(machine.stopDurations.length+3,1).string(from.toTimeString().slice(0,8)).style(style);
                sheet.cell(machine.stopDurations.length+3,2).string(to.toTimeString().slice(0,8)).style(style);
                sheet.cell(machine.stopDurations.length+3,3).string(hh+':'+mm+':'+ss).style(style);
            }
        });
        workbook.write('./data/stopTimings.xlsx');
		
		var sheet=fs.readFileSync('./data/stopTimings.xlsx');
		mailer.sendMail({
			from: '"Priyansh Bhardwaj" <priyanshbh@gmail.com>',
			to: 'priyanshbhj@gmail.com',
			subject: 'Stop Timings of '+new Date().toDateString(),
			text: 'Please find excel sheet in attachment',
			attachments: [{'filename': 'stopTimings.xlsx', 'content': sheet}]
		},(err,info) => {
			if(err){
				return console.log(err);
			}
		});
        console.log("Stop duration exported at data/stopTimings.xlsx Successfully!");
    },(err) => console.log(err));
}