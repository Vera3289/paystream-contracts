#[cfg(test)]
mod regression_tests {
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        Address, Env,
    };

    #[test]
    fn regression_stream_lifecycle_and_withdrawal() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let employer = Address::generate(&env);
        let employee = Address::generate(&env);
        let token_id = env.register(paystream_token::TokenContract, ());
        let token = paystream_token::TokenContractClient::new(&env, &token_id);
        token.initialize(&employer, &10_000);

        let stream_id = env.register(paystream_stream::StreamContract, ());
        let stream = paystream_stream::StreamContractClient::new(&env, &stream_id);
        stream.initialize(&admin);
        let id = stream.create_stream(&employer, &employee, &token_id, &10_000, &10, &0);

        env.ledger().with_mut(|l| l.timestamp += 100);
        let withdrawn = stream.withdraw(&employee, &id);
        assert_eq!(withdrawn, 1000);
        assert_eq!(stream.get_stream(&id).withdrawn, 1000);
    }

    #[test]
    fn regression_token_transfer_and_balance() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        let token_id = env.register(paystream_token::TokenContract, ());
        let token = paystream_token::TokenContractClient::new(&env, &token_id);
        token.initialize(&admin, &1_000);
        token.transfer(&admin, &user, &400);

        assert_eq!(token.balance(&admin), 600);
        assert_eq!(token.balance(&user), 400);
    }
}
