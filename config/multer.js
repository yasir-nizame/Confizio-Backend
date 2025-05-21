import multer from "multer";

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("application")) {
    cb(null, true);
  } else {
    cb("Error");
  }
};

const upload = multer({ storage: multerStorage, fileFilter: multerFilter });

export default upload;
