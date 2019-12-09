# cnc-time-tracker
Stop Time Tracker of CNC Machines

## Installation
Following command will install all dependencies packages
```
npm install
```

## Start Running
Simply Run
```
nmp start
```
or
```
node index.js
```
to Start the code

## Description of Code
### index.js
Using mqtt protocol, it listens to socket that sends cnc machine data. It tracks the status of machines only in shift duration (from 09:00 to 21:30) including overtime.

### export.js
At the end of a shift, export function is called that processes current day's shift into excel sheet and sends the sheet to target mail id.

### machineModel.js
Mongoose Schema for collection that tracks the current day's status of machines.

### recordModel.js
Mongoose Schema for collection that stored stop-durations of all machines of all days.

## Dependencies
* [excel4node](https://www.npmjs.com/package/excel4node)
* [mongoose](https://www.npmjs.com/package/mongoose)
* [mqtt](https://www.npmjs.com/package/mqtt)
* [nodemailer](https://www.npmjs.com/package/nodemailer)
