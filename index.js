const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const dbConnect = require('./dbConnect/dbConnect'); // Import the database connection
const user = require('./routes/user'); 
const serviceproject = require('./routes/serviceproject'); 
const industrytestimonial = require('./routes/industrytestimonial'); 
const webdata = require('./routes/getwebdata'); 
const auth = require('./middlewares/adminAuth');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const app = express();
const PORT = 3005;

// Connect to MongoDB
app.use(cors({
    origin: ['http://localhost:3000', process.env.Client_Url],
    credentials: true
}))
app.use(express.static('public'));
app.use(cookieParser());




app.use((req, res, next) => {
    console.log(`Path hit: ${req.originalUrl}`);
    next();
  });
app.get('/', (req, res) => {
    res.send('Hello World!');
})
app.use('/api',auth, serviceproject);
app.use('/api',auth, industrytestimonial);
app.use(express.json());
app.use('/api', webdata); 
app.use('/api', user);

app.use((req, res, next) => {
    console.log(`Path hit: ${req.originalUrl}`);
    console.log('This route does not exist!');
    res.status(404).send('This route does not exist!');
  });

const start = async () => {
  await dbConnect();
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
};

start()
