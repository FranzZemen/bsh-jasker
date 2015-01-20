## Installation

    npm install bsh-jasker

## Notes:

  - Uses bunyan as a logging system.

  If youre not used to bunyan and want to parse logs, install bunyan -g and pipe output to bunyan (see docs).

  Supports setting the bunyan streams array for Jasker core classes.  See bunyan on how to structure the array.


## Current Functionality:

### Since v0.0.13

  - Define the bunyan streams array to use for logging.  If not provided, uses process.stdout

### Since v0.0.12

  - Create JaskerMap
  - Create a simple state map consisting of static next states
  - Supports cloning for multiple downstream states (flow splits).  Careful, merges are not yet implemented.  If you clone and re-merge on a common state, all entry tasks will be executed more than one time and if splitMode was copy the document will not merge.


## Usage/Sample Application

 See https://github.com/FranzZemen/bsh-jasker-sample

## Current Config Object

 Structure of the configuration:

    {
        name: Required Unique String
        docKeyField : Optional String
        states: {
            stateExample1: {
                code: Optional Alphanumeric
                data: Optional Static Object
                next: Optional String or Array of Strings
                nextDecision: Optional subclass of JaskerNextDecision
                splitMode: Optional String of value 'clone' or 'reference'
            },
            stateExample2 : {}
        }
    }

Where:

  - **name**: Required Unique String: Represents the name of this JaskerMap

  - **docKeyField**: Optional String: If a document is provided, this is a field that represents its key (and therefore document.key exists).

  Even if a document is provided, this is optional.  The JaskerInstance will append the document  key value to its internal instance refernece.  It greatly assists troubleshooting, maintenance, data mining etc.,

  - **code**: Optional Alphanumeric: an optional arbitrary alpha-numeric value

  - **data**: Optional Static Object: arbitrary static JSON contents that is provided to custome BSHLogic implementations when operating on this state

  - **next**: Optional String or Array of Strings: Statically provided next state name (for instance, state2).

  If neither next nor nextDecision are provided, the state is considered to be a terminal state.

  - **nextDecision**: Optional subclass of JaskerNextDecision or requires path (see Injection section).  JaskerNextDecision is used to determine dynamically what the downstream state(s) are.

  If neither next nor nextDecision are provided, the state is considered to be a terminal state.

  - **splitMode**:  Optional String of value 'clone' or 'reference': If set to 'clone' then the underlying domain document within the JaskerInstnace, if provided is copied.  If missing or set to 'reference' then the underlying domain document is shared.

  Since this can be set at each state, different splitModes can be used depending on the type of flows.

  For example, if the split is permanent (never re-merged, it may represent a flow that goes to different business units or systems.  In that case a splitMode of 'clone' is appropriate.

  On the other hand, if changes are being made in parallel, but the changes should be made to the latest version, then a splitMode of reference is appropriate

  lodash.cloneDeep is used for the cloning process - the document must be compatible with that method,


## Injection

 A number of derived classes in the API can be injected in the state engine configuration to provide custom behavior.  These are typically subclasses of a class beginning with Jasker...

 In all cases specification for these injections can be included by:

  - Providing the actual class constructor for inline configurations

  - Providing the module name for npm installed constructors

  - Providing the module name and NODE_PATH environment variable for non-npm installed constructors

  - Providing the relative path to the JaskerMap module (which most likely is sitting in node_modules/bsh-jasker/core)

 In the last three cases, JaskerMap will 'require' the constructor.  Thus, that operation should result in the constructor (require('SomeConstructor') = SomeConstructor

## API

 The API documents what is intended for public consumption.  It does not document public methods that are intended for and used by the core but for which public usage could result in unintended consequences.

### Types of methods and properties

 For usage and debugging reference, we define several types of methods and properties based on OO principles.

  - **Private Methods/Properties**:  Defined in the constructor or (more rarely) in the node module.  These are not externally accessible.

  - **Privileged Methods**:  Defined in the constructor of the module on 'this', these have access to private methods and properties but are publicly accessible.  They are **not** on the object prototype.

  - **Public Methods**:  Defined on the object prototype.  Typically such methods are intended for subclass implementation and, unless there is acceptable default behavior, will throw an Error ('Not implemented') in the base class implementation.

  - **Accessors/Mutators**:  Priviledged or Public Methods that take an optional parameter.  Following JavaScript community conventions, when no parameter is passed, they are accessors; given a parameter they are mutators.  Sometimes only an accessor is provided.

### JaskerMap Class API

   - JaskerMap is a controller for a particular state configuration.   It is the core workhorse that calculates next states, rollbacks etc.

   - Jasker implementations may have one ore more JaskerMap.  They may have one or more JaskerMap instances of the same flow although there are consequences to that.

##### JaskerMap(bunyanStreams)

  - Constructor

  - Parameters:

        bunyanStreams  Object, Optional.  The bunyan streams configuration for Jasker. If none is provided, uses stdout with level info

##### name

  - Priviledged method:  Accessor returning the name of the underlying state engine configuration.

  - Returns String

### JaskerInstance Class API

  -JaskerInstance is a controller for a particular instance of the state configuration, and the main gateway to Jasker for public usage.

#### JaskerInstance(jaskerMap, document, start)

  - Constructor

  - Parameters:

         jaskerMap:  Required.  An instance of JaskerMap.

         document:  Optional.  A domain object that travels with the state flow.  The document can be as simple or as complex as desired, but it must be streamable as JSON.  While its optional, it is passed to Jasker... class implementationss.  These implementations can of course obtain domain objects themselves.  At opposite ends of the spectrum, a document (if provided) could represent everything about a domain, or just an identifier.

         start:  Optional.  The state within JaskerMap that represents the starting state.  If none is provided, the first state in the configuration is used.  Note that if start is provided and no document, then the value for document should be 'undefined'.

#### document

  - Priviledged method:  Accessor returning the domain document

  - Returns Object

#### next

  - Priviledged method: Invoke the transition(s) to the next state for this instance.  The result, including what functional operations and ending states are entirely dependent on the JaskerMap configuration.

  Note that a rollback was necessary, or if the state is terminal, the instance state will remain the same.

  - Returns Promise - success value is an Array of JaskerInstance, each set to the resulting states.  If no splits are configured, the array will be of length 1.  The err value is of JavaScript class Error

### JaskerNextDecision Class API

  - JaskerNextDecision determines the next state(s) at a given state.  The Jasker client needs to subclass from JaskerNextDecision.  Currently it must execute synchronously.

#### JaskerNextDecision

  - Constructor

#### next(document, state, stateData)

  - Public method:  Given a document, the current state and the optional stateData, determine the next state(s).  This method will
  be called by Jasker's core and is supplied by the Jasker client.

  - Parameters:

        document: (Object) The document provided to the JaskerInstance, or undefined if none was provided

        state:  (String) The current state of the underlying JaskerMap

        stateData: (Object) The data configured on the state, or undefined if none was configured

  - Returns (Array of String) State names that represent the next state in the JaskerMap.  This is supplied by the client implementation.
