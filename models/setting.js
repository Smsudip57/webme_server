const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema(
  {
    loginOn:{
        type: Boolean,
        default: false
    }
  }
);


const Setting = mongoose.models.Setting || mongoose.model('Setting', settingSchema);

module.exports = Setting;
