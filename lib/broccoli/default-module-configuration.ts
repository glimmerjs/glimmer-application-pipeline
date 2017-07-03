export default {
  types: {
    application: { definitiveCollection: 'main' },
    component: { definitiveCollection: 'components' },
    'component-test': { unresolvable: true },
    helper: { definitiveCollection: 'components' },
    'helper-test': { unresolvable: true },
    renderer: { definitiveCollection: 'main' },
    template: { definitiveCollection: 'components' }
  },
  collections: {
    main: {
      types: ['application', 'renderer']
    },
    components: {
      group: 'ui',
      types: ['component', 'component-test', 'template', 'helper', 'helper-test'],
      defaultType: 'component',
      privateCollections: ['utils']
    },
    styles: {
      group: 'ui',
      unresolvable: true
    },
    utils: {
      unresolvable: true
    }
  }
};
