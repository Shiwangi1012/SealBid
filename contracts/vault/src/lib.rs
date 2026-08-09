#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    AuctionContract,
    NativeToken,
}

#[contract]
pub struct TimeLockVaultContract;

#[contractimpl]
impl TimeLockVaultContract {
    /// Sets the authorized auction contract address.
    pub fn initialize(env: Env, auction_contract: Address, native_token: Address) {
        if env.storage().instance().has(&DataKey::AuctionContract) {
            panic!("already initialized");
        }
        env.storage()
            .instance()
            .set(&DataKey::AuctionContract, &auction_contract);
        env.storage()
            .instance()
            .set(&DataKey::NativeToken, &native_token);
    }

    /// Only callable by the authorized auction contract.
    /// Transfers `amount` stroops of XLM to `to`.
    pub fn release(env: Env, auction_contract: Address, to: Address, amount: i128) {
        auction_contract.require_auth();

        let authorized: Address = env
            .storage()
            .instance()
            .get(&DataKey::AuctionContract)
            .expect("not initialized");

        if auction_contract != authorized {
            panic!("unauthorized caller");
        }

        if amount <= 0 {
            panic!("amount must be positive");
        }

        let native_token: Address = env
            .storage()
            .instance()
            .get(&DataKey::NativeToken)
            .expect("no native token set");

        let token_client = token::Client::new(&env, &native_token);
        token_client.transfer(&env.current_contract_address(), &to, &amount);
    }
}
