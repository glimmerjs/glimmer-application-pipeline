module.exports = {
  disable_watching: true,
  launch_in_ci: ['Mocha'],
  launch_in_dev: ['Mocha'],
  launchers: {
    Mocha: {
      command: "mocha dist/tests --recursive --reporter tap",
      protocol: 'tap'
    }
  }
};
