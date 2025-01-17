import promptImp = require('prompt-sync')
import { readStr } from './reader'
import { pr_str } from './printer'
import { MalType, MalNumber, MalList, MalFunc, MalTypes, MalSymbol, MalString, MalMap, MalBoolean, MalNil } from './types'
import { Env } from './env'
import { ns, not } from './core'
const prompt = promptImp({sigint: true})

interface MalEnvironment {
    [key: string]: MalFunc;
}

function READ(input: string): MalType {
    return readStr(input)
}

function EVAL(mal: MalType, env: Env): MalType {
    return eval_ast(mal, env)
}

function PRINT(mal: MalType): string {
    return pr_str(mal, true)
}

function REP(input: string, repl_env: Env): string {
    const r = READ(input)
    const e = EVAL(r, repl_env)
    const p = PRINT(e)
    return p
}

function eval_ast(ast: MalType, repl_env: Env): MalType {
    switch(ast.type) {
        case MalTypes.Number:
        case MalTypes.Function:
        case MalTypes.Nil:
        case MalTypes.Boolean:
        case MalTypes.String:
            return ast
        case MalTypes.Symbol:
            // Assumes that value for the symbol in the env is "resolved"
            // i.e. it is either an atom or function
            const symbol = ast as MalSymbol
            return repl_env.get(symbol)

        case MalTypes.Map:
            const map = (ast as MalMap)
            const evaluated_map = new MalMap()
            for (const [k, v] of map.map) {
                evaluated_map.map.set(k, eval_ast(v, repl_env))
            }
            return evaluated_map
        case MalTypes.List:
            // Empty List/Vector
            if ((ast as MalList).list.length === 0) return ast as MalList

            // Vector
            if ((ast as MalList).isVector) {
                const vector = (ast as MalList).list
                const evaluated_vector = vector.map((malItem) => eval_ast(malItem, repl_env))
                return new MalList(evaluated_vector, true)
            }
            
            // List 
            const list = (ast as MalList).list
            if (list[0].type === MalTypes.Symbol && (list[0] as MalSymbol).value === "def!") {
                const symbol = list[1] as MalSymbol
                const value = eval_ast(list[2], repl_env)
                def(symbol, value, repl_env)
                return value
            } else if (list[0].type === MalTypes.Symbol && (list[0] as MalSymbol).value === "let*") {
                const newEnv = new Env(repl_env)
                const bindingList = (list[1] as MalList).list
                for (let i = 0; i < bindingList.length - 1; i += 2) {
                    const key = bindingList[i] as MalSymbol
                    const value = eval_ast(bindingList[i+1], newEnv)
                    newEnv.set(key, value)
                }
                const expr = list[2]
                return eval_ast(expr, newEnv)
            } else if (list[0].type === MalTypes.Symbol && (list[0] as MalSymbol).value === "if") {
                const condition = eval_ast(list[1], repl_env)
                if (condition.type === MalTypes.Nil || 
                    ((condition.type === MalTypes.Boolean) && !(condition as MalBoolean).value)) {
                        // false condition
                        return list[3] ? eval_ast(list[3], repl_env) : new MalNil() 
                    }
                else {
                    return eval_ast(list[2], repl_env)
                }
            } else if (list[0].type === MalTypes.Symbol && (list[0] as MalSymbol).value === "do") {
                const params = list.slice(1)
                return params.map((malItem) => eval_ast(malItem, repl_env))[params.length-1]
            } else if (list[0].type === MalTypes.Symbol && (list[0] as MalSymbol).value === "fn*") {
                const [, args, binds] = list 
                if (args.type !== MalTypes.List) 
                    throw new Error(`unexpected return type: ${args.type}, expected: list or vector`)

                const symbols = (args as MalList).list.map(item => {
                    if (item.type !== MalTypes.Symbol) 
                        throw new Error(`unexpected return type: ${item.type}, expected: symbol`)
                    return item as MalSymbol
                })
                const closure = (...fnArgs: MalType[]) => eval_ast(binds, new Env(repl_env, symbols, fnArgs))
                return new MalFunc(closure)
            }
             else {
                // non-special forms
                // evaluate each item in array, then apply the function to the args
                const evaluated_list = list.map((malItem) => eval_ast(malItem, repl_env))
                const func = evaluated_list[0] as MalFunc
                const args = new MalList(evaluated_list.slice(1, evaluated_list.length))
                return func.apply(args)
            }
        default: 
            throw new Error("MalType: " + ast.type + " not recognized.")
    }
}

function def(key: MalSymbol, value: MalType, env: Env): void {
    env.set(key, value)
}




function createEnv(): Env {
    const env = new Env()
    Array.from(ns.keys()).forEach(key => 
        env.set(new MalSymbol(key), ns.get(key) as MalFunc)
    )
    REP(not, env)
    return env
}

export function main() {
    const _env = createEnv()
    while (true) {
        let line: string = prompt('user> ')
        if (line == null) {
            break;
        }
        if (line === "") {
            continue;
        }
        try {
            console.log(REP(line, _env))
        } catch (error) {
            console.log(error)
        }
    }
}

// For testing
module.exports = {
    main,
    READ,
    EVAL,
    PRINT,
    REP,
    eval_ast,
    createEnv
}
