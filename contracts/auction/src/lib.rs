#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Bytes, BytesN, Env, Vec,
};

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    BiddingDeadline,
    RevealDeadline,
    Commitment(Address),
    Deposit(Address),
    RevealedAmount(Address),
    Winner,
    Finalized,
    Bidders,
    NativeToken,
}

// ---------------------------------------------------------------------------
// Phase enum (returned by get_state)
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone, PartialEq)]
pub enum Phase {
    Bidding,
    Reveal,
    Finalized,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct AuctionContract;

#[contractimpl]
impl AuctionContract {
    // -----------------------------------------------------------------------
    // initialize
    // -----------------------------------------------------------------------

    pub fn initialize(
        env: Env,
        admin: Address,
        native_token: Address,
        bidding_deadline: u64,
        reveal_deadline: u64,
    ) {
        // Can only be called once
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::NativeToken, &native_token);
        env.storage()
            .instance()
            .set(&DataKey::BiddingDeadline, &bidding_deadline);
        env.storage()
            .instance()
            .set(&DataKey::RevealDeadline, &reveal_deadline);
        env.storage().instance().set(&DataKey::Finalized, &false);
        env.storage()
            .instance()
            .set(&DataKey::Bidders, &Vec::<Address>::new(&env));
    }

    // -----------------------------------------------------------------------
    // commit  — called during BIDDING phase
    // commitment = sha256( amount_u64_le_bytes ++ salt_bytes_32 )
    // -----------------------------------------------------------------------

    pub fn commit(env: Env, bidder: Address, commitment: BytesN<32>, deposit: i128) {
        bidder.require_auth();
        Self::assert_phase(&env, Phase::Bidding);

        // Must not have committed already
        if env
            .storage()
            .persistent()
            .has(&DataKey::Commitment(bidder.clone()))
        {
            panic!("already committed");
        }

        if deposit <= 0 {
            panic!("deposit must be positive");
        }

        // Pull XLM from bidder into this contract
        let native_token: Address = env.storage().instance().get(&DataKey::NativeToken).unwrap();
        let token_client = token::Client::new(&env, &native_token);
        token_client.transfer(&bidder, &env.current_contract_address(), &deposit);

        env.storage()
            .persistent()
            .set(&DataKey::Commitment(bidder.clone()), &commitment);
        env.storage()
            .persistent()
            .set(&DataKey::Deposit(bidder.clone()), &deposit);

        // Track bidder list
        let mut bidders: Vec<Address> = env.storage().instance().get(&DataKey::Bidders).unwrap();
        bidders.push_back(bidder);
        env.storage().instance().set(&DataKey::Bidders, &bidders);
    }

    // -----------------------------------------------------------------------
    // reveal  — called during REVEAL phase
    // -----------------------------------------------------------------------

    pub fn reveal(env: Env, bidder: Address, amount: u64, salt: BytesN<32>) {
        bidder.require_auth();
        Self::assert_phase(&env, Phase::Reveal);

        // Must have a commitment
        let stored_commitment: BytesN<32> = env
            .storage()
            .persistent()
            .get(&DataKey::Commitment(bidder.clone()))
            .expect("no commitment found");

        // Recompute hash: sha256(amount_le_bytes ++ salt)
        let computed = Self::compute_commitment(&env, amount, &salt);

        if computed != stored_commitment {
            panic!("hash mismatch");
        }

        env.storage()
            .persistent()
            .set(&DataKey::RevealedAmount(bidder.clone()), &amount);

        env.events()
            .publish((symbol_short!("reveal"), bidder.clone()), amount);
    }

    // -----------------------------------------------------------------------
    // finalize  — callable after reveal_deadline
    // -----------------------------------------------------------------------

    pub fn finalize(env: Env) {
        let reveal_deadline: u64 = env
            .storage()
            .instance()
            .get(&DataKey::RevealDeadline)
            .unwrap();
        if env.ledger().timestamp() < reveal_deadline {
            panic!("reveal phase not ended");
        }

        let finalized: bool = env.storage().instance().get(&DataKey::Finalized).unwrap();
        if finalized {
            panic!("already finalized");
        }

        let bidders: Vec<Address> = env.storage().instance().get(&DataKey::Bidders).unwrap();
        let mut winner: Option<Address> = None;
        let mut highest: u64 = 0;

        for i in 0..bidders.len() {
            let bidder = bidders.get(i).unwrap();
            if let Some(amount) = env
                .storage()
                .persistent()
                .get::<DataKey, u64>(&DataKey::RevealedAmount(bidder.clone()))
            {
                if amount > highest {
                    highest = amount;
                    winner = Some(bidder.clone());
                }
            }
        }

        if let Some(w) = winner {
            env.storage().instance().set(&DataKey::Winner, &w);
        }
        env.storage().instance().set(&DataKey::Finalized, &true);

        env.events().publish((symbol_short!("finalize"),), highest);
    }

    // -----------------------------------------------------------------------
    // claim_refund  — losers call this after finalize
    // -----------------------------------------------------------------------

    pub fn claim_refund(env: Env, bidder: Address) {
        bidder.require_auth();

        let finalized: bool = env.storage().instance().get(&DataKey::Finalized).unwrap();
        if !finalized {
            panic!("not finalized yet");
        }

        // Winner cannot claim refund
        let winner: Option<Address> = env.storage().instance().get(&DataKey::Winner);
        if let Some(w) = winner {
            if w == bidder {
                panic!("winner cannot claim refund");
            }
        }

        let deposit: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Deposit(bidder.clone()))
            .expect("no deposit found");

        if deposit == 0 {
            panic!("already refunded");
        }

        // Zero out before transferring (re-entrancy guard)
        env.storage()
            .persistent()
            .set(&DataKey::Deposit(bidder.clone()), &0i128);

        let native_token: Address = env.storage().instance().get(&DataKey::NativeToken).unwrap();
        let token_client = token::Client::new(&env, &native_token);
        token_client.transfer(&env.current_contract_address(), &bidder, &deposit);
    }

    // -----------------------------------------------------------------------
    // get_state
    // -----------------------------------------------------------------------

    pub fn get_state(env: Env) -> Phase {
        let finalized: bool = env
            .storage()
            .instance()
            .get(&DataKey::Finalized)
            .unwrap_or(false);
        if finalized {
            return Phase::Finalized;
        }
        let now = env.ledger().timestamp();
        let bidding_deadline: u64 = env
            .storage()
            .instance()
            .get(&DataKey::BiddingDeadline)
            .unwrap();
        let reveal_deadline: u64 = env
            .storage()
            .instance()
            .get(&DataKey::RevealDeadline)
            .unwrap();

        if now < bidding_deadline {
            Phase::Bidding
        } else if now < reveal_deadline {
            Phase::Reveal
        } else {
            // Reveal deadline passed but not yet finalized
            Phase::Reveal
        }
    }

    // -----------------------------------------------------------------------
    // get_winner (convenience)
    // -----------------------------------------------------------------------

    pub fn get_winner(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Winner)
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    fn current_phase(env: &Env) -> Phase {
        let finalized: bool = env
            .storage()
            .instance()
            .get(&DataKey::Finalized)
            .unwrap_or(false);
        if finalized {
            return Phase::Finalized;
        }
        let now = env.ledger().timestamp();
        let bidding_deadline: u64 = env
            .storage()
            .instance()
            .get(&DataKey::BiddingDeadline)
            .unwrap();
        let reveal_deadline: u64 = env
            .storage()
            .instance()
            .get(&DataKey::RevealDeadline)
            .unwrap();

        if now < bidding_deadline {
            Phase::Bidding
        } else if now < reveal_deadline {
            Phase::Reveal
        } else {
            Phase::Finalized
        }
    }

    fn assert_phase(env: &Env, expected: Phase) {
        let actual = Self::current_phase(env);
        if actual != expected {
            match expected {
                Phase::Bidding => panic!("not in bidding phase"),
                Phase::Reveal => panic!("not in reveal phase"),
                Phase::Finalized => panic!("not finalized"),
            }
        }
    }

    fn compute_commitment(env: &Env, amount: u64, salt: &BytesN<32>) -> BytesN<32> {
        // sha256( amount_u64_le_bytes ++ salt_bytes_32 )
        let mut data = Bytes::new(env);
        // append 8 bytes of amount in little-endian
        let le = amount.to_le_bytes();
        for b in le.iter() {
            data.push_back(*b);
        }
        // append salt
        data.append(&salt.clone().into());
        env.crypto().sha256(&data).into()
    }
}
