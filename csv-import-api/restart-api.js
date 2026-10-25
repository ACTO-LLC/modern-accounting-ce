const { exec } = require('child_process');

// Find PID of process using port 7072
exec('netstat -ano | findstr :7072', (err, stdout, stderr) => {
    if (err) {
        console.log('No process found on port 7072, starting server...');
        startServer();
        return;
    }

    const lines = stdout.trim().split('\n');
    if (lines.length > 0) {
        const parts = lines[0].trim().split(/\s+/);
        const pid = parts[parts.length - 1];

        console.log(`Killing process ${pid}...`);
        exec(`taskkill /F /PID ${pid}`, (err) => {
            if (err) console.error('Failed to kill process:', err);
            else console.log('Process killed.');

            // Wait a bit and start server
            setTimeout(startServer, 1000);
        });
    } else {
        startServer();
    }
});

function startServer() {
    console.log('Starting server...');
    const server = require('child_process').spawn('node', ['server.js'], {
        detached: true,
        stdio: 'ignore',
        cwd: __dirname
    });
    server.unref();
    console.log('Server started in background.');
}
