const axios = require("axios");
const { Routes, baseURL } = require("../config");
const auth = require("../api/middlewares/auth");
let localURL = `http://localhost:8000`;

module.exports.userDataAPI = async (authKey) => {
  let config = {
    method: "get",
    maxBodyLength: Infinity,
    url: `${Routes.userService}/getprofile`,
    headers: {
      Authorization: authKey,
    },
  };

  return axios
    .request(config)
    .then((response) => {
      return response.data;
    })
    .catch((error) => {
      console.log(error);
      throw error;
    });
};

module.exports.getWH = async (authKey, whKey) => {
  let config = {
    method: "get",
    maxBodyLength: Infinity,
    url: `${Routes.warehouseService}/get/bykey?whKey=${whKey}`,
    headers: {
      Authorization: authKey,
    },
  };

  return axios
    .request(config)
    .then((response) => {
      return response.data;
    })
    .catch((error) => {
      //console.log(error);
      throw error;
    });
};
module.exports.getActiveWarehouses = async (authKey) => {
  let config = {
    method: "get",
    maxBodyLength: Infinity,
    url: `${Routes.warehouseService}/getall/active`,
    headers: {
      Authorization: authKey,
    },
  };

  return axios
    .request(config)
    .then((response) => {
      return response.data;
    })
    .catch((error) => {
      throw error;
    });
};
module.exports.getLocationsByIds = async (authKey, ids) => {
  let ar = JSON.stringify(ids);
  let config = {
    method: "get",
    maxBodyLength: Infinity,
    url: `${baseURL}/warehouse/locations/byids?ids=${ar}`,
    headers: {
      Authorization: authKey,
    },
  };

  return axios
    .request(config)
    .then((response) => {
      return response.data;
    })
    .catch((error) => {
      //console.log(error);
      throw error;
    });
};

module.exports.addQtyToLoc = async (authKey, locData) => {
  let config = {
    method: "post",
    maxBodyLength: Infinity,
    url: `${baseURL}/warehouse/locations/addquantity`,
    headers: {
      Authorization: authKey,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(locData),
  };

  return axios
    .request(config)
    .then((response) => {
      console.log(response.data);
      return response.data;
    })
    .catch((error) => {
      //console.log(error);
      throw error;
    });
};

module.exports.createInventoryTransferTasks = async (authKey, taskData) => {
  let config = {
    method: "post",
    maxBodyLength: Infinity,
    url: `${Routes.userService}/tasks/picking/create/invtran`,
    headers: {
      Authorization: authKey,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(taskData),
  };

  return axios
    .request(config)
    .then((response) => {
      console.log(response.data);
      return response.data;
    })
    .catch((error) => {
      //console.log(error);
      throw error;
    });
};
