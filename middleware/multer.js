import multer from "multer";

// Set up Multer to store files temporarily in memory
const storage = multer.memoryStorage(); //saving in buffer temporarily
const upload = multer({ storage });

export default upload;
