/**
 * Shared shape for a "tuner domain": the bundle of domain-specific data and pure
 * functions that the generic store factory (createTunerStore) and the generic UI
 * components (ParameterCard, ParameterPanel, PresetSelector, ConfigOutput,
 * InfoDrawer, GraphPanel) consume. Each tuner — swap, systemd — exports one of
 * these from src/tuners/<id>/index.js, built with defineTuner(), which fills
 * in the hooks marked optional below and asserts the rest in dev and tests.
 * This file is JSDoc-only; there is no runtime export, it just documents the
 * contract in one place.
 *
 * @typedef {Object} TunerSection
 * @property {string}   id
 * @property {string}   title
 * @property {string}   summary
 * @property {string[]} keys
 *
 * @typedef {Object} TunerContext
 * @property {string} badge   Short tag shown on a parameter card (e.g. 'K8s')
 * @property {string} label   Full label used in the drawer (e.g. 'Kubernetes')
 * @property {string} url     "Source" link for the contextual note
 *
 * @typedef {Object} TunerFormula
 * @property {string}   title
 * @property {string[]} lines
 * @property {{label:string, v:string}[]} values
 *
 * @typedef {Object} TunerProfile
 * @property {string} title        Heading of the profile card
 * @property {string} applyLabel   Text of the apply button
 * @property {import('./profile.js').ProfileField[]} fields  See core/profile.js
 * @property {(hw:Object, label:(key:string, value:string)=>string)=>string[]} summary  Rich-text parts of the collapsed summary
 *
 * @typedef {Object} TunerGraphTab
 * @property {string} id
 * @property {string} label
 * @property {Object} component  A chart component (reads the store via useActiveTuner)
 * @property {string} blurb
 *
 * @typedef {Object} TunerDomain
 * @property {string}   id
 * @property {TunerProfile} profile
 * @property {Object}   defaultHardware  Derived by defineTuner from the profile defaults
 * @property {readonly string[]} parameterKeys
 * @property {Record<string, Object>} defsByKey
 * @property {(hw:Object)=>Object} deriveDefaults
 * @property {(key:string, hw:Object)=>{min:number,max:number}} rangeFor
 * @property {(hw:Object, params:Object, facts?:Record<string, number>)=>any[]} validate  Facts from earlier setup steps; none on the tuner's own page
 * @property {(hw:Object, params:Object)=>Record<string, number>} [facts]  Values for later setup steps (core/machine.js MACHINE_FACTS). Omitted in the spec = none.
 * @property {string[]} [readsFacts]  Facts validate reads. Omitted in the spec = none.
 * @property {(issues:any[])=>boolean} hasBlockingIssue
 * @property {(value:number, def:Object, hw:Object)=>string} formatValue
 * @property {TunerSection[]} sections
 * @property {(section:TunerSection, params:Object, hw:Object)=>string[]} [visibleKeys]
 * @property {any[]}    presets
 * @property {Record<string, any>} presetsById
 * @property {(opts:Object)=>import('./output/files.js').ConfigFile[]} generateConfig  Built with the core/output writers
 * @property {(state:Object)=>string} encodeState     Derived by defineTuner (core/serialization.js)
 * @property {(s:string)=>Object|null} decodeState    Derived by defineTuner, schema from the profile
 * @property {number}   [linkVersion]  Shared-link envelope version; bumped when a parameter is added, so older links are refused. Omitted in the spec = 1.
 * @property {string|null} defaultTab    Id of one of graphTabs; defaults to the first, null without tabs
 * @property {TunerGraphTab[]} [graphTabs]  Omitted in the spec = no graphs (full-width tune step, no impact bar)
 * @property {Record<string, unknown>} [simulation]  Pure (hardware, params) functions; `impactSummary` feeds the impact metrics
 * @property {string[]} workloads        Workload values compared in the drawer
 * @property {string}   workloadField    Hardware key the workloads vary (e.g. 'workload')
 * @property {TunerContext} context
 * @property {(hw:Object)=>boolean} [contextApplies]  Gate the contextual badge/note on hardware (e.g. only show K8s guidance when workload is k8s). Omitted in the spec = always show.
 * @property {string}   docsLabel        Label for the per-parameter docs link
 * @property {string}   noteKey          Def field holding the contextual note
 * @property {string}   [defaultLabel]   Whose default def.kernelDefault is ("systemd default"). Omitted in the spec = 'Kernel default'.
 * @property {(def:Object, ctx:{hardware:Object,params:Object})=>(TunerFormula|null)} [formula]
 * @property {(def:Object, text:string)=>(string|null)} [tryCommand]  The drawer's command that sets the value until reboot (core/output sysctlTryCommand, sysfsTryCommand). Omitted in the spec = none.
 * @property {Object}   page    Page copy for TunerPage (hero, step titles, ad slot), from about.js
 * @property {Object}   about   About/methodology content for AboutSection, from about.js
 */

export {}
