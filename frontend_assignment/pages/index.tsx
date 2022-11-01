import detectEthereumProvider from "@metamask/detect-provider"
import { Strategy, ZkIdentity } from "@zk-kit/identity"
import { generateMerkleTree, generateMerkleProof, Semaphore } from "@zk-kit/protocols"
import { Contract, providers, utils } from "ethers"
import Head from "next/head"
import React from "react"
import styles from "../styles/Home.module.css"
import {Card, CardContent, Typography } from '@mui/material';
import UserForm from './form/UserForm';
import Greeter from 'artifacts/contracts/Greeters.sol/Greeters.json';

export default function Home() {
    const [logs, setLogs] = React.useState("Connect your wallet and greet!")

    async function greet() {
        setLogs("Creating your Semaphore identity...")

        const provider = (await detectEthereumProvider()) as any

        await provider.request({ method: "eth_requestAccounts" })

        const ethersProvider = new providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()
        const message = await signer.signMessage("Sign this message to create your identity!")

        const identity = new ZkIdentity(Strategy.MESSAGE, message)
        const identityCommitment = identity.genIdentityCommitment()
        const identityCommitments = await (await fetch("./identityCommitments.json")).json()

        const merkleProof = generateMerkleProof(20, BigInt(0), identityCommitments, identityCommitment)

        setLogs("Creating your Semaphore proof...")

        const greeting = "Hello world"

        const witness = Semaphore.genWitness(
            identity.getTrapdoor(),
            identity.getNullifier(),
            merkleProof,
            merkleProof.root,
            greeting
        )

        const { proof, publicSignals } = await Semaphore.genProof(witness, "./semaphore.wasm", "./semaphore_final.zkey")
        const solidityProof = Semaphore.packToSolidityProof(proof)

        const response = await fetch("/api/greet", {
            method: "POST",
            body: JSON.stringify({
                greeting,
                nullifierHash: publicSignals.nullifierHash,
                solidityProof: solidityProof
            })
        })

        if (response.status === 500) {
            const errorMessage = await response.text()

            setLogs(errorMessage)
        } else {
            setLogs("Your anonymous greeting is onchain :)")
        }
    }

    const [greeting, setGreeting] = React.useState('');
	React.useEffect(() => {listenGreeting()})

    async function listenGreeting() {
		try {
            const provider = (await detectEthereumProvider()) as any
            await provider.request({ method: "eth_requestAccounts" })
            const ethersProvider = new providers.Web3Provider(provider)
            
			const greetingContract = new Contract(
				'0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
				Greeter.abi,
                ethersProvider
			)
            
            greetingContract.on('NewGreeting', (greeting) => {
                console.log(utils.parseBytes32String(greeting))
                setGreeting(utils.parseBytes32String(greeting))
            })
		} catch (error) {
			console.error(error);
		}
	}

    const GreetingCard = () => (
		<Card className={styles.card}>
			<CardContent>
				<Typography gutterBottom>{greeting}</Typography>
			</CardContent>
		</Card>
	)

    return (
        <div className={styles.container}>
            <Head>
                <title>Greetings</title>
                <meta name="description" content="A simple Next.js/Hardhat privacy application with Semaphore." />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}>Greetings</h1>

                <p className={styles.description}>A simple Next.js/Hardhat privacy application with Semaphore.</p>

                <div className={styles.logs}>{logs}</div>

                <div onClick={() => greet()} className={styles.button}>
                    Greet
                </div>
                <Card variant="outlined" sx={{ my: { xs: 3, md: 6 }, p: { xs: 2, md: 3 } }}>
                <GreetingCard />
                    <UserForm />
                </Card>
            </main>
        </div>
    )
}
