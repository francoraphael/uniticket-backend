const stringToLiteral = value => {
  try {
    return new Function('return ' + value + ';')();
  } catch (e) {
    return value;
  }
};

export default stringToLiteral;
