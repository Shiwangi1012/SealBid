#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, Vec};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    AuctionContract,
    NativeToken,
}

#[contract]
pub struct RefundDistributorContract;

#[contractimpl]
impl RefundDistributorContract {
    /// Sets the authorized auction contract.
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

    /// Called by the auction contract after finalize.
    /// Sends `amount_each` stroops to every address in `losers`.
    pub fn batch_refund(
        env: Env,
        auction_contract: Address,
        losers: Vec<Address>,
        amount_each: i128,
    ) {
        auction_contract.require_auth();

        let authorized: Address = env
            .storage()
            .instance()
            .get(&DataKey::AuctionContract)
            .expect("not initialized");

        if auction_contract != authorized {
            panic!("unauthorized caller");
        }

        if amount_each <= 0 {
            panic!("amount must be positive");
        }

        let native_token: Address = env
            .storage()
            .instance()
            .get(&DataKey::NativeToken)
            .expect("no native token set");

        let token_client = token::Client::new(&env, &native_token);

        for i in 0..losers.len() {
            let loser = losers.get(i).unwrap();
            token_client.transfer(&env.current_contract_address(), &loser, &amount_each);
        }
    }
}
