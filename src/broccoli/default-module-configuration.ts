export default {
  types: {
    application: { definitiveCollection: 'main' },
    component: { definitiveCollection: 'components' },
    renderer: { definitiveCollection: 'main' },
    template: { definitiveCollection: 'components' }
  },
  collections: {
    main: {
      types: ['application', 'renderer']
    },
    components: {
      group: 'ui',
      types: ['component', 'template'],
      defaultType: 'component',
      privateCollections: ['utils']
    },
    utils: {
      unresolvable: true
    }
  }
};
