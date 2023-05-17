import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose'


export default mongoose
  .connect(process.env.MONGODB, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('mongo rab'))
  .catch((err) => console.log(err));