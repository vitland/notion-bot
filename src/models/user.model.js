import mongoose from 'mongoose';
const { Schema } = mongoose;
const UserSchema = new Schema({
  telegramId: { type: String },
  status: { type: String },
  name: { type: String },
  userType: { type: String },
  notification:{type:Number,
  default:0},
  timeStamp:{type:Number,
    default:0}
});

export default mongoose.model('users', UserSchema);
