const express = require('express');
const router = express.Router();
const Session = require('../models/session');
const User = require('../models/user');
const Service = require('../models/service');
const socket = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');


router.post('/start-session', async (req, res) => {
  try {
    const guestCookie = req.cookies.session_uid;
    const { email , name , userId, type } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      const createsession = async (email, name) => {
        if (email && name) {
          const generateUid = uuidv4();
          const token = jwt.sign({ uid: generateUid }, process.env.JWT_SECRET);
    
          res.cookie('session_uid', token, {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            path: '/',
          });
    
          const newSession = new Session({
            uid: {
              email: email,
              name: name,
              uid: generateUid
            },
            status: 'active',
            type: type
          });
    
          await newSession.save();
          return newSession; // ✅ Return session instead of sending response
        }
        return null; // ✅ Return null if email/name is missing
      };
    
      if (guestCookie) {
        let decoded;
        try {
          decoded = jwt.verify(guestCookie, process.env.JWT_SECRET);
        } catch (error) {
          res.cookie('session_uid', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/',
          });
          return res.status(401).json({ error: 'Unauthorized' });
        }
    
        const session = await Session.findOne({
          "uid.uid": decoded.uid,
          status: 'active',
          type: type
        });
    
        if (!session) {
          const newSession = await createsession(email, name);
          if (!newSession) {
            return res.status(400).json({ error: 'Could not create session' }); // ✅ Handle session creation failure
          }
          return res.status(201).json({ sessionId: newSession._id });
        }
    
        return res.status(200).json({ sessionId: session._id });
      } else {
        const newSession = await createsession(email, name);
        if (!newSession) {
          return res.status(400).json({ error: 'Could not create session' }); // ✅ Prevent duplicate response
        }
        return res.status(201).json({ sessionId: newSession._id }); // ✅ Send response only once
      }
    }
    

//   const service = await Service.findOne({ _id: serviceId });
//   if (!service) {
//     return res.status(404).json({ error: 'Service not found' });
//   }
  const existingSession = await Session.findOne({
    user: userId || null,
    status: 'active',
    type: type
  })
  if (existingSession) {
    return res.status(200).json({ sessionId: existingSession._id });
  }
  // Create a new session
  const session = new Session({
    user: user?._id || null,
    status: 'active',
    type:type
  });
  
  await session.save();

  res.status(201).json({ sessionId: session._id });
  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({ error: 'Failed to start session' });
  }
});


router.get('/fetch-session', async (req, res) => {
  const guestCookie = req.cookies.session_uid;
  try {
    const { userid } = req.query;
    if ( !userid) {
      if(guestCookie){
        let decoded 
        try {
          decoded = jwt.verify(guestCookie, process.env.JWT_SECRET);
        } catch (error) {
          res.cookie('session_uid', '', {
            httpOnly: true,
            secure: false,
            sameSite: 'strict',
            path: '/',
          });
          return res.status(401).json({ error: 'Unauthorized' });
        }
        const session = await Session.find({ 
          "uid.uid":decoded.uid,
          status: 'active'
        });
        if (!session) {
          res.cookie('session_uid', '', {
            httpOnly: true,
            secure: false,
            sameSite: 'strict',
            path: '/',
          });
          return res.status(404).json({ error: 'Session not found' });
        }
        return res.status(200).json(session);
      }else{
        return res.status(404).json({ message: 'Session not found' });
      }
    }
  
    let find;
        
    try {
        const user = await User.findById(userid);
      if(user){
          find = { user: user._id, status: 'active' };
        }else{
          return;
            find = { unregisteredUserToken: token, status: 'active' };
        }
    } catch (error) {
        return res.status(401).json({ message: 'Invalid user ID' });
    }

  const session = await Session.find(find)

  if (!session) {
    return res.status(404).json({ message: 'Session not found' });
  }

  return res.json(session);
    
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ message: 'Failed to fetch session' });
  }
});


router.get('/all-sessions', async (req, res) => {
  try {
    const { email } = req.query;

  if (!email ) {
    return res.status(400).json({ message: 'Unauthorized access' });
  }
  const user = await User.findOne({ email });
  if (!user || user.role !== 'admin') {
    return res.status(400).json({ message: 'Unauthorized access' });
  }
  const session = await Session.aggregate([
    {
      $addFields: {
        latestMessageTimestamp: {
          $max: "$messages.timestamp",
        },
        statusSortOrder: {
          $cond: { if: { $eq: ["$status", "active"] }, then: 1, else: 2 },
        },
      },
    },
    {
      $sort: {
        statusSortOrder: 1,
        latestMessageTimestamp: -1,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "user",
      },
    },
    {
      $unwind: { path: "$user", preserveNullAndEmptyArrays: true },
    },
    // Populate user.booking with service details
    {
      $lookup: {
        from: "services",
        localField: "user.booking.service",
        foreignField: "_id",
        as: "user.bookingDetails",
      },
    },
    {
      $addFields: {
        "user.booking": {
          $map: {
            input: "$user.booking",
            as: "bookingItem",
            in: {
              $mergeObjects: [
                "$$bookingItem",
                {
                  serviceDetails: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$user.bookingDetails",
                          as: "service",
                          cond: { $eq: ["$$service._id", "$$bookingItem.service"] },
                        },
                      },
                      0,
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    },
    {
      $project: {
        "user.bookingDetails": 0, // Remove temporary bookingDetails field
      },
    },
  ]);
  
      
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }
    res.json(session);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch session', error: error.message });
  }
  
});



router.get('/seen', async (req, res) => {
    const { sessionId } = req.query;
  
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID not provided' });
    }
  
    try {
      const session = await Session.findOneAndUpdate(
        { _id: sessionId },
        {
          $set: {
            'messages.$[message].isReadByAdmin': true,
          },
        },
        {
          arrayFilters: [{ 'message.isReadByAdmin': { $ne: true } }],
          new: true,
        }
      );
  
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
  
      // Correctly update the messages array using map
    //   session.messages = session.messages.map((message) => ({
    //     ...message,
    //     isReadByAdmin: true,
    //   }));
  
    //   await session.save();
      res.json({ message: 'Session marked as seen' });
    } catch (error) {
      console.error('Error marking session as seen:', error);
      res.status(500).json({ message: 'Failed to mark session as seen' });
    }
  });


router.post('/delete', async (req, res) => {
    const { sessionId } = req.body;
  
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID not provided' });
    }
  
    try {
      const session = await Session.findOneAndDelete({ _id: sessionId });
  
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
  
      res.json({ message: 'Session deleted successfully' });
    } catch (error) {
      console.error('Error deleting session:', error);
      res.status(500).json({ message: 'Failed to delete session' });
    }
  });



router.post('/end', async (req, res) => {
    const { sessionId } = req.body;
  
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID not provided' });
    }
  
    try {
      const session = await Session.findOneAndUpdate({ _id: sessionId }, { status: 'ended' });
  
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
  
      res.json({ message: 'Session ended successfully' });
    } catch (error) {
      console.error('Error deleting session:', error);
      res.status(500).json({ message: 'Failed to delete session' });
    }
  });


  module.exports = router;