const fs = require('fs');
const path = require('path');

const junitPath = path.resolve(process.cwd(), 'reports', 'junit-results.xml');
const xml = fs.readFileSync(junitPath, 'utf8');

const fixed = xml.replace(/<testcase name="([^"]+)" classname="([^"]+)" time="([^"]+)">/g, (match, name, classname, time) => {
  const filePath = classname.replace(/\\/g, '/');
  return `<testcase name="${name}" classname="${classname}" time="${time}" file="${filePath}">`;
});

fs.writeFileSync(junitPath, fixed, 'utf8');
console.log('Updated JUnit file paths in', junitPath);