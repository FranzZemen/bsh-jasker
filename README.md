## Notes:
- Uses bunyan as a logging system.  If youre not used to bunyan and want to parse logs, install bunyan -g and pipe output to bunyan (see docs).

## Current Functionality:
  - Create JaskerMap
  - Create a simple state map consisting of static next states
  - Supports cloning for multiple downstream states (flow splits)

## Sample Application

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

  - **splitMode**:  Optional String of value 'clone' or 'reference': If set to 'clone' then the underlying domain document within the JaskerInstnace, if provided is copied.  If missing or set to 'reference' then the underlying domain document is shared.

  Since this can be set at each state, different splitModes can be used depending on the type of flows.

  For example, if the split is permanent (never re-merged, it may represent a flow that goes to different business units or systems.  In that case a splitMode of 'clone' is appropriate.

  On the other hand, if changes are being made in parallel, but the changes should be made to the latest version, then a splitMode of reference is appropriate

  lodash.cloneDeep is used for the cloning process - the document must be compatible with that method,