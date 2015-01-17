# Notes:
- Uses bunyan as a logging system.  If you're not used to bunyan and want to parse logs, install bunyan -g and pipe output to bunyan (see docs).

# Functionality (list appended as features are added):
  - Create JaskerMap
  - Create a simple state map consisting of static next states
  - Current version of the configuration specification:

    {
        name: 'String, required: a required unique string representing the name of this JaskerMap',
        states: {
            stateExample1: {
                code: 'Alphanumeric, optional: an optional arbitrary alpha-numeric value',
                data: 'Object, optional: arbitrary static JSON contents that is provided to custome BSHLogic ' +
                'implementations when operating on this state',
                next: 'String, optional: statically provided next state name (for instance, ‘state2’).  If next is specified ' +
                'any entry in nextDecision will be ignored.  If neither next nor nextDecision are provided, the ' +
                'state is considered to be a terminal state.'
            },
            stateExample2 : {}
        }
    }
