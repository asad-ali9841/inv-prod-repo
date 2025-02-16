const express = require('express');
const cors  = require('cors');
const { inventory_api } = require('./api');
const {errorHandler} = require('./utils/error-handler')
module.exports = async (app, rbac) => {

    app.use(express.json({ limit: '100mb' }));
    app.use(cors());
    app.use(express.static(__dirname + '/public'))
    
    inventory_api(app, rbac);
    app.use(errorHandler);
    app.use('/', (req,res)=>{return res.json({
        status: 0,
        type: 'error',
        responseMessage: 'The URL does not exist',
        data: {},
    })})
}
