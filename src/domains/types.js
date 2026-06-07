/**
 * Shared shape for a "tuner domain": the bundle of domain-specific data and pure
 * functions that the generic store factory (createTunerStore) and the generic UI
 * components (ParameterCard, ParameterPanel, PresetSelector, ConfigOutput,
 * InfoDrawer, GraphPanel) consume. Each tuner — swap, systemd — exports one of
 * these from src/domains/<name>/index.js. This file is JSDoc-only; there is no
 * runtime export, it just documents the contract in one place.
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
 * @typedef {Object} TunerDomain
 * @property {string}   id
 * @property {Object}   defaultHardware
 * @property {readonly string[]} parameterKeys
 * @property {Record<string, Object>} defsByKey
 * @property {(hw:Object)=>Object} deriveDefaults
 * @property {(key:string, hw:Object)=>{min:number,max:number}} rangeFor
 * @property {(hw:Object, params:Object)=>any[]} validate
 * @property {(issues:any[])=>boolean} hasBlockingIssue
 * @property {(value:number, def:Object, hw:Object)=>string} formatValue
 * @property {TunerSection[]} sections
 * @property {(section:TunerSection, params:Object)=>string[]} [visibleKeys]
 * @property {any[]}    presets
 * @property {Record<string, any>} presetsById
 * @property {(opts:Object)=>string} generateConfig
 * @property {string}   outputFilename
 * @property {(state:Object)=>string} encodeState
 * @property {(s:string)=>Object|null} decodeState
 * @property {string}   defaultTab
 * @property {string[]} workloads        Workload values compared in the drawer
 * @property {string}   workloadField    Hardware key the workloads vary (e.g. 'workload')
 * @property {TunerContext} context
 * @property {string}   docsLabel        Label for the per-parameter docs link
 * @property {string}   noteKey          Def field holding the contextual note
 * @property {(def:Object, ctx:{hardware:Object,params:Object})=>(TunerFormula|null)} [formula]
 */

export {}
