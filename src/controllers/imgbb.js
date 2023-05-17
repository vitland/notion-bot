import dotenv from 'dotenv';
dotenv.config()
import imgbbUploader from 'imgbb-uploader'

 export default (file) => {
  const imgbbOpts = {
    apiKey: process.env.IMGBB_TOKEN,
    imageUrl: `https://api.telegram.org/file/bot${process.env.TELEGRAM_TOKEN}/${file.file_path} `,
  };
  return imgbbUploader(imgbbOpts).catch((err)=> {
    console.log(err)
    return err})
 }
  
