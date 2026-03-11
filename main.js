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

// Function 6 [cite: 190-200]
function setBonus(textFile, driverID, date, newValue) {
    let lines = fs.readFileSync(textFile, 'utf8').trim().split('\n');
    let updatedLines = lines.map(line => {
        let columns = line.split(',');
        if (columns[0] === driverID && columns[2] === date) {
            columns[9] = String(newValue);
        }
        return columns.join(',');
    });
    fs.writeFileSync(textFile, updatedLines.join('\n') + '\n');
}

// Function 7 [cite: 211-218]
function countBonusPerMonth(textFile, driverID, month) {
    let lines = fs.readFileSync(textFile, 'utf8').trim().split('\n');
    let driverFound = false;
    let count = 0;
    let searchMonth = month.toString().padStart(2, '0');

    for (let line of lines) {
        let p = line.split(',');
        if (p[0] === driverID) {
            driverFound = true;
            let recordMonth = p[2].split('-')[1];
            // Check for the string "true" as it appears in the text file
            if (recordMonth === searchMonth && p[9].trim() === 'true') {
                count++;
            }
        }
    }
    return driverFound ? count : -1;
}

// Function 8 [cite: 239-245]
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
    let lines = fs.readFileSync(textFile, 'utf8').trim().split('\n');
    let totalSec = 0;
    let searchMonth = month.toString().padStart(2, '0');

    for (let line of lines) {
        let p = line.split(',');
        if (p[0] === driverID && p[2].split('-')[1] === searchMonth) {
            totalSec += toSeconds(p[7]);
        }
    }
    return fromSeconds(totalSec);
}

// Function 9 [cite: 252-263]
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
    let rates = fs.readFileSync(rateFile, 'utf8').trim().split('\n');
    let driverRateLine = rates.find(l => l.startsWith(driverID));
    let dayOff = driverRateLine.split(',')[1].trim();
    
    let shifts = fs.readFileSync(textFile, 'utf8').trim().split('\n');
    let totalReqSeconds = 0;
    let searchMonth = month.toString().padStart(2, '0');

    for (let line of shifts) {
        let p = line.split(',');
        if (p[0] === driverID && p[2].split('-')[1] === searchMonth) {
            let dayName = new Date(p[2]).toLocaleDateString('en-US', { weekday: 'long' });
            if (dayName !== dayOff) {
                let isEid = (p[2] >= "2025-04-10" && p[2] <= "2025-04-30");
                totalReqSeconds += isEid ? (6 * 3600) : (8 * 3600 + 24 * 60);
            }
        }
    }
    let finalSeconds = totalReqSeconds - (bonusCount * 2 * 3600);
    return fromSeconds(Math.max(0, finalSeconds));
}

// Function 10 [cite: 274-286]
function getNetPay(driverID, actualHours, requiredHours, rateFile) {
    let rates = fs.readFileSync(rateFile, 'utf8').trim().split('\n');
    let line = rates.find(l => l.startsWith(driverID)).split(',');
    let basePay = parseInt(line[2]);
    let tier = parseInt(line[3]);

    let actual = toSeconds(actualHours) / 3600;
    let required = toSeconds(requiredHours) / 3600;

    if (actual >= required) return basePay;

    let missing = required - actual;
    let allowanceMap = { 1: 50, 2: 20, 3: 10, 4: 3 };
    let billableHours = Math.floor(Math.max(0, missing - allowanceMap[tier]));
    
    let deductionRate = Math.floor(basePay / 185);
    return basePay - (billableHours * deductionRate);
}

// Ensure the module exports ALL 10 functions
module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};