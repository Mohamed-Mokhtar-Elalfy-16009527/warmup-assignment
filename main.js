const fs = require('fs');



function toSeconds(hms) {
   
    const isAmPm = hms.toLowerCase().includes('am') || hms.toLowerCase().includes('pm');
    
    if (isAmPm) {
        let [time, period] = hms.split(' ');
        let [h, m, s] = time.split(':').map(Number);
        if (period.toLowerCase() === 'pm' && h < 12) h += 12;
        if (period.toLowerCase() === 'am' && h === 12) h = 0;
        return (h * 3600) + (m * 60) + s;
    } else {
        let [h, m, s] = hms.split(':').map(Number);
        return (h * 3600) + (m * 60) + s;
    }
}

function fromSeconds(totalSec) {
    let h = Math.floor(totalSec / 3600);
    let m = Math.floor((totalSec % 3600) / 60);
    let s = totalSec % 60;
   
    let mm = m < 10 ? "0" + m : m;
    let ss = s < 10 ? "0" + s : s;
    return h + ":" + mm + ":" + ss;
}



//Function 1
function getShiftDuration(startTime, endTime) {
    let diff = toSeconds(endTime) - toSeconds(startTime);
    return fromSeconds(diff);
}

// Functtion 2 
function getIdleTime(startTime, endTime) {
    let start = toSeconds(startTime);
    let end = toSeconds(endTime);
    let dayStart = toSeconds("8:00:00 am");
    let dayEnd = toSeconds("10:00:00 pm");
    
    let idle = 0;
    if (start < dayStart) idle += (dayStart - start);
    if (end > dayEnd) idle += (end - dayEnd);
    
    return fromSeconds(idle);
}

// Function 3 
function getActiveTime(shiftDuration, idleTime) {
    let duration = toSeconds(shiftDuration);
    let idle = toSeconds(idleTime);
    return fromSeconds(duration - idle);
}

// Function 4 
function metQuota(date, activeTime) {
    let activeSeconds = toSeconds(activeTime);
    // Special Eid Period: April 10 to April 30, 2025
    let isEid = (date >= "2025-04-10" && date <= "2025-04-30");
    let quotaSeconds = isEid ? (6 * 3600) : (8 * 3600 + 24 * 60);
    
    return activeSeconds >= quotaSeconds;
}

//function 5
function addShiftRecord(textFile, shiftObj) {
    let fileContent = fs.readFileSync(textFile, 'utf8').trim();
    let lines = fileContent === "" ? [] : fileContent.split('\n');
    
   
    for (let line of lines) {
        let parts = line.split(',');
        if (parts[0] === shiftObj.driverID && parts[2] === shiftObj.date) {
            return {};
        }
    }

    // Calculate needed fields
    let duration = getShiftDuration(shiftObj.startTime, shiftObj.endTime);
    let idle = getIdleTime(shiftObj.startTime, shiftObj.endTime);
    let active = getActiveTime(duration, idle);
    let quota = metQuota(shiftObj.date, active);

    let newEntry = [
        shiftObj.driverID, shiftObj.driverName, shiftObj.date,
        shiftObj.startTime, shiftObj.endTime, duration,
        idle, active, quota, false
    ].join(',');

    // Insert after the last record of this driver ID if it exists
    let lastIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith(shiftObj.driverID)) lastIndex = i;
    }

    if (lastIndex === -1) {
        lines.push(newEntry);
    } else {
        lines.splice(lastIndex + 1, 0, newEntry);
    }

    fs.writeFileSync(textFile, lines.join('\n') + '\n');
    
    return {
        ...shiftObj,
        shiftDuration: duration,
        idleTime: idle,
        activeTime: active,
        metQuota: quota,
        hasBonus: false
    };
}

module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord
};