import dotenv from 'dotenv';
dotenv.config();
import mongoose from './controllers/mongoose.js'
import { checkBugStatus, checkSceneOptions, checkTaskStatus, getUsers, newBugs, newTasks } from './controllers/notion.js'
import telegramController from './controllers/telegram.js'
telegramController.start()


setInterval(() => {
 checkTaskStatus(process.env.NOTION_TASK_DB)   
}, 10550);
setInterval(() => {
 newTasks(process.env.NOTION_TASK_DB)  
}, 5300);
setInterval(() => {
    getUsers(process.env.NOTION_USER_DB, "proger")
    getUsers(process.env.NOTION_GD_DB, "GD")
}, 6000);
setInterval(() => {
    newBugs(process.env.NOTION_BUGS_DB)
}, 6300);
setInterval(() => {
    checkBugStatus(process.env.NOTION_BUGS_DB)
}, 9400);


