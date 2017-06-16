import <%= functionName %> from './helper';

const { module, test } = QUnit;

module('Helper: <%= helperName %>', function(hooks) {
  test('it computes', function(assert) {
    assert.equal(<%= functionName %>([]), undefined);
  });
});
