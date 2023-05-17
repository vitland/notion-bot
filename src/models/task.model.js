import mongoose from 'mongoose';
const { Schema } = mongoose;
const TaskSchema = new Schema({
  taskId: { type: String },
  taskMessage: {type: Array},
  status: { type: String },
  priority: { type: String },
  assignedTo: {type:Array},
  proger:{type:Array},
  type: {type: String},
  timeStamp: {type: Number},
  notification:{type:Number,
  default:0}
});

export default mongoose.model('tasks', TaskSchema);
