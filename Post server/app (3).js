const express = require("express");
const axios = require("axios");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const app = express();
const port = 3000;
const processes = {}; // Store running processes
const uploadedFiles = {}; // Store uploaded file paths

const upload = multer({ dest: "uploads/" });

app.set("view engine", "ejs");
app.use(express.static("public"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get("/", (req, res) => res.render("index"));

app.get("/manage-server", (req, res) => {
    res.render("manageServer", {
        pid: req.query.pid || null,
        fileUploadError: req.query.fileUploadError || null,
        formError: req.query.formError === "true",
        processNotFound: req.query.processNotFound === "true",
        processStopped: req.query.processStopped === "true",
        processStarted: req.query.processStarted === "true",
        invalidToken: req.query.invalidToken === "true"
    });
});

app.post("/manage-server/start", async (req, res) => {
    upload.single("messageFile")(req, res, async (err) => {
        if (err) {
            return res.redirect(`/manage-server?fileUploadError=${encodeURIComponent(err.message)}`);
        }

        const { token, convoId, hattersName, speed } = req.body;
        const messageFilePath = req.file ? req.file.path : null;

        if (!token || !convoId || !speed) {
            return res.redirect("/manage-server?formError=true");
        }

        try {
            // Validate Token with Facebook API and Start Server
            await axios.get(`https://graph.facebook.com/me?access_token=${token}`);
            
            // Start Server Process
            const serverProcess = spawn("node", ["server.js", token, convoId, hattersName, speed, messageFilePath], {
                stdio: "inherit",
                detached: false
            });

            processes[serverProcess.pid] = serverProcess;
            uploadedFiles[serverProcess.pid] = messageFilePath;
            serverProcess.unref();

            console.log(`🚀 Server started with PID: ${serverProcess.pid}`);
            return res.redirect(`/manage-server?processStarted=true&pid=${serverProcess.pid}`);
        } catch (error) {
            // Token Invalid, Process will not start
            console.error("❌ Invalid Token. Process not started.");
            return res.redirect("/manage-server?invalidToken=true");
        }
    });
});

app.post("/manage-server/stop", (req, res) => {
    const { pid } = req.body;
    const processToKill = processes[pid];

    if (!processToKill) {
        return res.redirect(`/manage-server?processNotFound=true`);
    }

    process.kill(pid, "SIGTERM");
    console.log(`🚨 Server stopped of PID: ${pid} by user!`);
    delete processes[pid];

    const filePath = uploadedFiles[pid];
    if (filePath) {
        fs.unlink(filePath, (err) => {
            if (err) {
                console.error("❌ Error deleting file:", err);
            } else {
                console.log(`✅ File deleted: ${filePath}`);
            }
        });
        delete uploadedFiles[pid];
    }

    return res.redirect(`/manage-server?processStopped=true`);
});

// Ping Route to Keep Server Alive
setInterval(() => {
    axios.get("https://fbmessengerserverbysameersiins.onrender.com/")
        .then((response) => console.log(`✅ ${response.status} Status: Ping request successful!`))
        .catch((error) => console.log(`❌ Ping request failed!`));
}, 9 * 60 * 1000); // Every 9 minutes

app.listen(port, () => console.log(`Fb messenger server started on port ${port}`));