module.exports = () => {
  console.log("cors enabled");
  return (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    next();
  };
};