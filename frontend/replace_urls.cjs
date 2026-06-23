const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src');

function findAndReplace(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            findAndReplace(fullPath);
        } else if (fullPath.endsWith('.jsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;

            // Replace standard string literals: 'http://localhost:5000/api...' -> `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api...`
            if (content.includes("'http://localhost:5000/")) {
                content = content.replace(/'http:\/\/localhost:5000\//g, "`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/");
                modified = true;
            }

            // Replace template literals: `http://localhost:5000/api...` -> `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api...`
            if (content.includes("`http://localhost:5000/")) {
                content = content.replace(/`http:\/\/localhost:5000\//g, "`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/");
                modified = true;
            }

            // Replace exactly 'http://localhost:5000' without trailing slash
            if (content.includes("'http://localhost:5000'")) {
                content = content.replace(/'http:\/\/localhost:5000'/g, "(import.meta.env.VITE_API_URL || 'http://localhost:5000')");
                modified = true;
            }

            if (modified) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Updated: ${fullPath}`);
            }
        }
    }
}

findAndReplace(directoryPath);
console.log('Done replacing URLs!');
