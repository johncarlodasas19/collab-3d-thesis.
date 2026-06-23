const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src');

function fixFiles(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            fixFiles(fullPath);
        } else if (fullPath.endsWith('.jsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let original = content;

            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                // If the line has the template string but STILL has a trailing single quote
                if (lines[i].includes("`${import.meta.env.VITE_API_URL")) {
                    lines[i] = lines[i].replace("',", "`,");
                    lines[i] = lines[i].replace("')", "`)");
                }
            }
            content = lines.join('\n');

            if (original !== content) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log('Fixed trailing quotes:', fullPath);
            }
        }
    }
}

fixFiles(directoryPath);
console.log('Done fixing URLs!');
