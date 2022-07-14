const messages = [];

const saveMessage = (message) => {
  messages.push(message);
  console.log(messages);
};
const findMessageForUser = (userId) => {
  return messages.filter(({ from, to }) => from === userId || to === userId);
};

module.exports = {
  saveMessage,
  findMessageForUser,
};
